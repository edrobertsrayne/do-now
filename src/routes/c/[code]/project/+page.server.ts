import { getBank, openClass } from '#lib/server/app.ts';
import { chipColour, topicColours } from '#lib/palette.ts';

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	const bank = getBank(doc.course);
	const skills = new Map(bank.skills.map((s) => [s.id, s]));
	const colours = topicColours(bank.skills);
	return {
		code,
		title: doc.doNow?.title ?? '',
		items: (doc.doNow?.items ?? []).map((it, i) => {
			const skill = skills.get(it.skillId);
			const colour = colours.get(skill?.topic ?? '');
			return {
				n: i + 1,
				prompt: it.question.prompt,
				answer: it.question.answer,
				topic: skill?.topic ?? '',
				skill: skill?.title ?? '',
				chip: chipColour(i),
				dot: colour?.dot ?? '#5B4BC4',
				tint: colour?.tint ?? '#ECE8FB',
				ink: colour?.ink ?? '#3B2F86'
			};
		})
	};
}
