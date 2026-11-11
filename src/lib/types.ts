export type QuestionStatus = 'draft' | 'reviewed';

export interface Question {
	id: string;
	/** AQA command word, e.g. "State", "Define", "Name". */
	command: string;
	prompt: string;
	answer: string;
	status: QuestionStatus;
}

export interface Skill {
	id: string;
	title: string;
	topic: string;
	/** AQA spec point numbers, e.g. "4.1.1.1". */
	specRefs: string[];
	questions: Question[];
}

export interface Bank {
	/** Order is significant: used as the final scheduling tie-break. */
	skills: Skill[];
}

export interface SkillState {
	/** Lesson counter value when the teacher ticked the skill as taught. */
	taughtAt: number;
	/** Times the skill has appeared in a Do Now. */
	practices: number;
	/** Lesson of last practice, or `taughtAt` if never practised. */
	lastPracticed: number;
}

export interface ClassState {
	/** Number of Do Nows generated so far. */
	lesson: number;
	skills: Record<string, SkillState>;
	/** Question id -> lesson it was last shown. */
	lastUsed: Record<string, number>;
}

export interface Config {
	/** Lessons to wait after practice n. Practice counts past the end reuse the last value. */
	intervals: number[];
	size: number;
	/** Pad with not-yet-due skills when fewer than `size` are due. */
	fillToSize: boolean;
}

export type Reason = 'new' | 'due' | 'early';

export interface DoNowItem {
	skillId: string;
	question: Question;
	reason: Reason;
	/** Lessons past due (negative if early). */
	overdue: number;
	/** How many times the skill had been practised before this item. */
	priorPractices: number;
}

export interface DoNow {
	lesson: number;
	items: DoNowItem[];
}

/** Everything persisted for one class, stored as a single JSON document. */
export interface ClassDoc {
	state: ClassState;
	/** Questions per Do Now (config `size`, 4-6). */
	size: number;
	/** The most recently generated Do Now, so projector/print/key views are stable across reloads. */
	doNow: DoNow | null;
}
