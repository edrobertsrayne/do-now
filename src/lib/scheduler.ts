import type {
	Bank,
	ClassState,
	Config,
	DoNow,
	DoNowItem,
	Question,
	Reason,
	Skill,
	SkillState
} from './types.ts';

export const DEFAULT_CONFIG: Config = {
	intervals: [1, 2, 4, 8, 16, 32],
	size: 5,
	fillToSize: true
};

export function newClass(): ClassState {
	return { lesson: 0, skills: {}, lastUsed: {} };
}

export function intervalAfter(config: Config, practices: number): number {
	const last = config.intervals.length - 1;
	const value = config.intervals[Math.min(practices, last)];
	if (value === undefined || value < 1)
		throw new Error('config.intervals must be a non-empty list of integers >= 1');
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
		skills: {
			...state.skills,
			[skillId]: { taughtAt: state.lesson, practices: 0, lastPracticed: state.lesson }
		}
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

/** Fisher-Yates shuffle into a new array. */
function shuffled<T>(items: T[], rng: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j] as T, out[i] as T];
	}
	return out;
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
 * When more skills are due than there are slots, the due skills are sampled
 * uniformly at random without replacement (after the reserved new skill), so
 * practice is interleaved as well as spaced. `rng` returns [0, 1); inject a
 * seeded one for reproducible output.
 *
 * Padding ("early") items are bonus retrieval: they rotate by least recently
 * shown and do not advance the skill's schedule, so spacing is not collapsed.
 */
export function generateDoNow(
	bank: Bank,
	state: ClassState,
	config: Config = DEFAULT_CONFIG,
	rng: () => number = Math.random
): { state: ClassState; doNow: DoNow } {
	const lesson = state.lesson + 1;
	const candidates: Candidate[] = [];
	bank.skills.forEach((skill, index) => {
		const s = state.skills[skill.id];
		if (!s || skill.questions.length === 0) return;
		candidates.push({ skill, index, s, overdue: lesson - dueLesson(s, config) });
	});
	if (candidates.length === 0)
		return { state, doNow: { lesson: state.lesson, items: [], base: state } };
	candidates.sort(byPriority);

	const latestTaught = Math.max(...candidates.map((c) => c.s.taughtAt));
	const reserved = candidates.find(
		(c) => c.overdue >= 0 && c.s.practices === 0 && c.s.taughtAt === latestTaught
	);
	const lastShown = (c: Candidate) =>
		Math.max(...c.skill.questions.map((q) => state.lastUsed[q.id] ?? -Infinity));
	const early = config.fillToSize
		? candidates
				.filter((c) => c.overdue < 0)
				.sort((a, b) => lastShown(a) - lastShown(b) || byPriority(a, b))
		: [];

	const picked: { c: Candidate; reason: Reason }[] = [];
	if (reserved) picked.push({ c: reserved, reason: 'new' });
	const due = shuffled(
		candidates.filter((c) => c.overdue >= 0 && c !== reserved),
		rng
	);
	for (const c of due) {
		if (picked.length >= config.size) break;
		picked.push({ c, reason: 'due' });
	}
	for (const c of early) {
		if (picked.length >= config.size) break;
		picked.push({ c, reason: 'early' });
	}
	picked.sort((a, b) => byPriority(a.c, b.c));

	if (picked.length === 0)
		return { state: { ...state, lesson }, doNow: { lesson, items: [], base: state } };

	const skills = { ...state.skills };
	const lastUsed = { ...state.lastUsed };
	const items: DoNowItem[] = [];
	for (const { c, reason } of picked) {
		const question = pickQuestion(c.skill, state.lastUsed);
		// Candidates without questions are filtered out above.
		if (!question) throw new Error(`skill ${c.skill.id} has no questions`);
		items.push({
			skillId: c.skill.id,
			question,
			reason,
			overdue: c.overdue,
			priorPractices: c.s.practices
		});
		if (reason !== 'early')
			skills[c.skill.id] = { ...c.s, practices: c.s.practices + 1, lastPracticed: lesson };
		lastUsed[question.id] = lesson;
	}
	return { state: { lesson, skills, lastUsed }, doNow: { lesson, items, base: state } };
}

/**
 * Replace one question of a generated Do Now with the next-best skill's question.
 * Pure. The removed item's practice is rolled back (practice count, last-practised
 * lesson and question rotation) and the replacement is counted as practised exactly
 * as in generation, so schedules stay consistent. `state` is the class state after
 * generation. Returns null if there is nothing suitable to swap in, or the Do Now
 * predates replacement support.
 */
export function replaceItem(
	bank: Bank,
	state: ClassState,
	doNow: DoNow,
	index: number,
	config: Config = DEFAULT_CONFIG
): { state: ClassState; doNow: DoNow } | null {
	const { base, lesson } = doNow;
	const old = doNow.items[index];
	if (!base || !old) return null;

	// Undo the old item.
	const skills = { ...state.skills };
	const { [old.question.id]: _shown, ...otherUsed } = state.lastUsed;
	const lastUsed = otherUsed;
	const current = skills[old.skillId];
	if (current && old.reason !== 'early' && current.practices === old.priorPractices + 1) {
		skills[old.skillId] = {
			...current,
			practices: old.priorPractices,
			lastPracticed: base.skills[old.skillId]?.lastPracticed ?? current.taughtAt
		};
	}
	const baseUsed = base.lastUsed[old.question.id];
	if (baseUsed !== undefined) lastUsed[old.question.id] = baseUsed;

	const dismissed = [...new Set([...(doNow.dismissed ?? []), old.skillId])];
	const excluded = new Set([...dismissed, ...doNow.items.map((it) => it.skillId)]);
	const candidates: Candidate[] = [];
	bank.skills.forEach((skill, i) => {
		const s = skills[skill.id];
		if (!s || skill.questions.length === 0 || excluded.has(skill.id)) return;
		candidates.push({ skill, index: i, s, overdue: lesson - dueLesson(s, config) });
	});
	const lastShown = (c: Candidate) =>
		Math.max(...c.skill.questions.map((q) => lastUsed[q.id] ?? -Infinity));
	const due = candidates.filter((c) => c.overdue >= 0).sort(byPriority);
	const early = config.fillToSize
		? candidates
				.filter((c) => c.overdue < 0)
				.sort((a, b) => lastShown(a) - lastShown(b) || byPriority(a, b))
		: [];
	const next = due[0] ?? early[0];

	let item: DoNowItem;
	if (next) {
		const reason: Reason = next.overdue < 0 ? 'early' : next.s.practices === 0 ? 'new' : 'due';
		const question = pickQuestion(next.skill, lastUsed);
		if (!question) return null;
		item = {
			skillId: next.skill.id,
			question,
			reason,
			overdue: next.overdue,
			priorPractices: next.s.practices
		};
		if (reason !== 'early')
			skills[next.skill.id] = { ...next.s, practices: next.s.practices + 1, lastPracticed: lesson };
	} else {
		// No other skill to offer: try a different question for the same skill.
		const skill = bank.skills.find((s) => s.id === old.skillId);
		const alternatives = skill?.questions.filter((q) => q.id !== old.question.id) ?? [];
		if (!skill || alternatives.length === 0) return null;
		const question = pickQuestion({ ...skill, questions: alternatives }, lastUsed);
		if (!question) return null;
		item = { ...old, question };
		// Same skill again: its practice is unchanged, so undo the rollback.
		if (current) skills[old.skillId] = current;
		dismissed.length = 0;
		dismissed.push(...(doNow.dismissed ?? []));
	}
	lastUsed[item.question.id] = lesson;

	const items = doNow.items.map((it, i) => (i === index ? item : it));
	return { state: { ...state, skills, lastUsed }, doNow: { ...doNow, items, dismissed } };
}
