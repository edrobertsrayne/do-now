import type { Bank, ClassState, Config, DoNow, DoNowItem, Question, Reason, Skill, SkillState } from './types.ts';

export const DEFAULT_CONFIG: Config = {
	intervals: [1, 3, 6, 12, 24],
	size: 4,
	fillToSize: true
};

export function newClass(): ClassState {
	return { lesson: 0, skills: {}, lastUsed: {} };
}

export function intervalAfter(config: Config, practices: number): number {
	const last = config.intervals.length - 1;
	const value = config.intervals[Math.min(practices, last)];
	if (value === undefined || value < 1) throw new Error('config.intervals must be a non-empty list of integers >= 1');
	return value;
}

export function dueLesson(skill: SkillState, config: Config): number {
	return skill.lastPracticed + intervalAfter(config, skill.practices);
}

/** Tick a skill as taught at the current lesson. No-op if already taught. */
export function markTaught(bank: Bank, state: ClassState, skillId: string): ClassState {
	if (!bank.skills.some((s) => s.id === skillId)) throw new Error(`Unknown skill: ${skillId}`);
	if (state.skills[skillId]) return state;
	return {
		...state,
		skills: { ...state.skills, [skillId]: { taughtAt: state.lesson, practices: 0, lastPracticed: state.lesson } }
	};
}

/** Untick a skill. Drops its schedule state. */
export function unmarkTaught(state: ClassState, skillId: string): ClassState {
	if (!state.skills[skillId]) return state;
	const { [skillId]: _removed, ...rest } = state.skills;
	return { ...state, skills: rest };
}

interface Candidate {
	skill: Skill;
	index: number;
	s: SkillState;
	overdue: number;
}

function byPriority(a: Candidate, b: Candidate): number {
	return b.overdue - a.overdue || a.s.taughtAt - b.s.taughtAt || a.index - b.index;
}

/** Never-used first, then least recently used, then bank order. */
function pickQuestion(skill: Skill, lastUsed: Record<string, number>): Question | undefined {
	let best: Question | undefined;
	let bestUsed = Infinity;
	for (const q of skill.questions) {
		const used = lastUsed[q.id] ?? -Infinity;
		if (used < bestUsed) {
			best = q;
			bestUsed = used;
		}
	}
	return best;
}

/**
 * Generate the next Do Now. Pure: returns the new class state and the quiz.
 * With no taught skills the state is returned unchanged and the quiz is empty,
 * so the lesson counter does not advance. If skills are taught but none is due
 * (and padding is off) the lesson still advances with an empty quiz.
 *
 * Padding ("early") items are bonus retrieval: they rotate by least recently
 * shown and do not advance the skill's schedule, so spacing is not collapsed.
 */
export function generateDoNow(
	bank: Bank,
	state: ClassState,
	config: Config = DEFAULT_CONFIG
): { state: ClassState; doNow: DoNow } {
	const lesson = state.lesson + 1;
	const candidates: Candidate[] = [];
	bank.skills.forEach((skill, index) => {
		const s = state.skills[skill.id];
		if (!s || skill.questions.length === 0) return;
		candidates.push({ skill, index, s, overdue: lesson - dueLesson(s, config) });
	});
	if (candidates.length === 0) return { state, doNow: { lesson: state.lesson, items: [] } };
	candidates.sort(byPriority);

	const latestTaught = Math.max(...candidates.map((c) => c.s.taughtAt));
	const reserved = candidates.find((c) => c.overdue >= 0 && c.s.practices === 0 && c.s.taughtAt === latestTaught);
	const lastShown = (c: Candidate) => Math.max(...c.skill.questions.map((q) => state.lastUsed[q.id] ?? -Infinity));
	const early = config.fillToSize
		? candidates.filter((c) => c.overdue < 0).sort((a, b) => lastShown(a) - lastShown(b) || byPriority(a, b))
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

	const skills = { ...state.skills };
	const lastUsed = { ...state.lastUsed };
	const items: DoNowItem[] = [];
	for (const { c, reason } of picked) {
		const question = pickQuestion(c.skill, state.lastUsed)!;
		items.push({ skillId: c.skill.id, question, reason, overdue: c.overdue, priorPractices: c.s.practices });
		if (reason !== 'early') skills[c.skill.id] = { ...c.s, practices: c.s.practices + 1, lastPracticed: lesson };
		lastUsed[question.id] = lesson;
	}
	return { state: { lesson, skills, lastUsed }, doNow: { lesson, items } };
}
