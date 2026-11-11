/** Soft Planner colours. Each topic gets a colour by its position in the course's bank order. */

export interface TopicColour {
	/** Saturated swatch: nav dot, progress bar, labels' dot. */
	dot: string;
	/** Pale wash: taught skill rows, revealed answers. */
	tint: string;
	/** Dark text readable on `tint` and on white. */
	ink: string;
}

const FIRST: TopicColour = { dot: '#F2C14E', tint: '#FDF3D9', ink: '#7A5A00' };

const TOPIC_COLOURS: TopicColour[] = [
	FIRST,
	{ dot: '#5DA9E9', tint: '#E3F0FB', ink: '#1D5A8C' },
	{ dot: '#7BC67E', tint: '#E6F4E6', ink: '#2E6B31' },
	{ dot: '#C77DFF', tint: '#F3E6FF', ink: '#6A2C9E' },
	{ dot: '#F08A5D', tint: '#FDE9E0', ink: '#8C3B17' },
	{ dot: '#4ECDC4', tint: '#DFF6F4', ink: '#1F6B65' },
	{ dot: '#E86A92', tint: '#FCE4EC', ink: '#8E2350' },
	{ dot: '#8E9AAF', tint: '#ECEEF2', ink: '#47506A' }
];

/** Question-number chips, by position in the Do Now. Dark ink text passes on all of them. */
export const CHIP_COLOURS = ['#F2C14E', '#5DA9E9', '#F08A5D', '#7BC67E', '#E86A92', '#C77DFF'];

export function chipColour(index: number): string {
	return CHIP_COLOURS[index % CHIP_COLOURS.length] ?? '#F2C14E';
}

/** Topic names in first-seen order. */
export function topicOrder(skills: { topic: string }[]): string[] {
	return [...new Set(skills.map((s) => s.topic))];
}

export function topicColour(index: number): TopicColour {
	return TOPIC_COLOURS[index % TOPIC_COLOURS.length] ?? FIRST;
}

/** Map of topic name -> colour for a course's skills. */
export function topicColours(skills: { topic: string }[]): Map<string, TopicColour> {
	return new Map(topicOrder(skills).map((t, i) => [t, topicColour(i)]));
}
