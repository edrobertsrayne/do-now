export type QuestionStatus = 'draft' | 'reviewed';

export interface Question {
	id: string;
	/** Command word, e.g. "State", "Define", "Name". */
	command: string;
	prompt: string;
	answer: string;
	status: QuestionStatus;
}

export interface Skill {
	id: string;
	title: string;
	topic: string;
	/** Specification point numbers, e.g. "4.1.1.1". */
	specRefs: string[];
	questions: Question[];
}

export interface Bank {
	/** Order is significant: used as the final scheduling tie-break. */
	skills: Skill[];
}

/** One course's skills; ids need only be unique within the course. */
export interface Course {
	/** Directory name under `bank/`; stored on each class. */
	id: string;
	name: string;
	bank: Bank;
}

export interface Library {
	courses: Course[];
}

export interface QuestionState {
	/** Times the question has been practised (shown as `new`/`due`, not `early`). */
	practices: number;
	/** Lesson of last practice. */
	lastPracticed: number;
}

export interface ClassState {
	/** Number of Do Nows generated so far. */
	lesson: number;
	/** Skill id -> lesson counter value when the teacher ticked it as taught. */
	taught: Record<string, number>;
	/** Question id -> schedule. Absent = never practised: treated as { practices: 0, lastPracticed: taughtAt of its skill }. */
	questions: Record<string, QuestionState>;
	/** Question id -> lesson it was last shown (any reason, including early). */
	lastUsed: Record<string, number>;
}

export interface Config {
	/** Lessons to wait after practice n. Practice counts past the end reuse the last value. */
	intervals: number[];
	size: number;
	/** Pad with not-yet-due questions when fewer than `size` are due. */
	fillToSize: boolean;
}

export type Reason = 'new' | 'due' | 'early';

export interface DoNowItem {
	skillId: string;
	question: Question;
	reason: Reason;
	/** Lessons past due (negative if early). */
	overdue: number;
	/** How many times the question had been practised before this item. */
	priorPractices: number;
}

export interface DoNow {
	lesson: number;
	/** Teacher-supplied lesson title, shown on the projector. Absent on Do Nows made before titles existed. */
	title?: string;
	items: DoNowItem[];
}

/** Everything persisted for one class, stored as a single JSON document. */
export interface ClassDoc {
	/** Id of the course (a directory under `bank/`) this class is taught. */
	course: string;
	state: ClassState;
	/** Questions per Do Now (config `size`, 4-6). */
	size: number;
	/** The most recently generated Do Now, so projector/print/key views are stable across reloads. */
	doNow: DoNow | null;
}
