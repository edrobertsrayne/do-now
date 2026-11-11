import type {
	Bank,
	ClassState,
	Config,
	DoNow,
	DoNowItem,
	Question,
	QuestionState,
	Reason,
	Skill
} from './types.ts';

export const DEFAULT_CONFIG: Config = {
	intervals: [1, 2, 4, 8, 16, 32],
	size: 5,
	fillToSize: true
};

export function newClass(): ClassState {
	return { lesson: 0, taught: {}, questions: {}, lastUsed: {} };
}

export function intervalAfter(config: Config, practices: number): number {
	const last = config.intervals.length - 1;
	const value = config.intervals[Math.min(practices, last)];
	if (value === undefined || value < 1)
		throw new Error('config.intervals must be a non-empty list of integers >= 1');
	return value;
}

export function dueLesson(q: QuestionState, config: Config): number {
	return q.lastPracticed + intervalAfter(config, q.practices);
}

/** Tick a skill as taught at the current lesson. No-op if already taught. */
export function markTaught(bank: Bank, state: ClassState, skillId: string): ClassState {
	if (!bank.skills.some((s) => s.id === skillId)) throw new Error(`Unknown skill: ${skillId}`);
	if (Object.hasOwn(state.taught, skillId)) return state;
	return { ...state, taught: { ...state.taught, [skillId]: state.lesson } };
}

/** Untick a skill. Drops the schedules of all its questions. */
export function unmarkTaught(bank: Bank, state: ClassState, skillId: string): ClassState {
	if (!Object.hasOwn(state.taught, skillId)) return state;
	const { [skillId]: _removed, ...taught } = state.taught;
	const dropped = new Set(
		bank.skills.find((s) => s.id === skillId)?.questions.map((q) => q.id) ?? []
	);
	const questions = Object.fromEntries(
		Object.entries(state.questions).filter(([id]) => !dropped.has(id))
	);
	return { ...state, taught, questions };
}

interface Candidate {
	skill: Skill;
	question: Question;
	/** Position over every bank question, for a stable final tie-break. */
	index: number;
	taughtAt: number;
	q: QuestionState;
	overdue: number;
}

function byPriority(a: Candidate, b: Candidate): number {
	return b.overdue - a.overdue || a.taughtAt - b.taughtAt || a.index - b.index;
}

/**
 * Generate the next Do Now. Pure: returns the new class state and the quiz.
 * With no taught skills the state is returned unchanged and the quiz is empty,
 * so the lesson counter does not advance. If skills are taught but no question
 * is due (and padding is off) the lesson still advances with an empty quiz.
 *
 * Every question of a taught skill is scheduled on its own. Padding ("early")
 * items are bonus retrieval: they rotate by least recently shown and do not
 * advance the question's schedule, so spacing is not collapsed.
 */
export function generateDoNow(
	bank: Bank,
	state: ClassState,
	config: Config = DEFAULT_CONFIG
): { state: ClassState; doNow: DoNow } {
	const lesson = state.lesson + 1;
	const candidates: Candidate[] = [];
	let index = 0;
	for (const skill of bank.skills) {
		const taughtAt = state.taught[skill.id];
		for (const question of skill.questions) {
			const i = index++;
			if (taughtAt === undefined || !Object.hasOwn(state.taught, skill.id)) continue;
			const q = state.questions[question.id] ?? { practices: 0, lastPracticed: taughtAt };
			candidates.push({
				skill,
				question,
				index: i,
				taughtAt,
				q,
				overdue: lesson - dueLesson(q, config)
			});
		}
	}
	if (candidates.length === 0) return { state, doNow: { lesson: state.lesson, items: [] } };
	candidates.sort(byPriority);

	const latestTaught = Math.max(...candidates.map((c) => c.taughtAt));
	const reserved = candidates.find(
		(c) => c.overdue >= 0 && c.q.practices === 0 && c.taughtAt === latestTaught
	);
	const early = config.fillToSize
		? candidates
				.filter((c) => c.overdue < 0)
				.sort(
					(a, b) =>
						(state.lastUsed[a.question.id] ?? -Infinity) -
							(state.lastUsed[b.question.id] ?? -Infinity) || byPriority(a, b)
				)
		: [];

	const picked: { c: Candidate; reason: Reason }[] = [];
	if (reserved) picked.push({ c: reserved, reason: 'new' });
	for (const c of candidates) {
		if (picked.length >= config.size) break;
		if (c.overdue >= 0 && c !== reserved) picked.push({ c, reason: 'due' });
	}
	for (const c of early) {
		if (picked.length >= config.size) break;
		picked.push({ c, reason: 'early' });
	}
	picked.sort((a, b) => byPriority(a.c, b.c));

	if (picked.length === 0) return { state: { ...state, lesson }, doNow: { lesson, items: [] } };

	const questions = { ...state.questions };
	const lastUsed = { ...state.lastUsed };
	const items: DoNowItem[] = [];
	for (const { c, reason } of picked) {
		items.push({
			skillId: c.skill.id,
			question: c.question,
			reason,
			overdue: c.overdue,
			priorPractices: c.q.practices
		});
		if (reason !== 'early')
			questions[c.question.id] = { practices: c.q.practices + 1, lastPracticed: lesson };
		lastUsed[c.question.id] = lesson;
	}
	return { state: { lesson, taught: state.taught, questions, lastUsed }, doNow: { lesson, items } };
}
