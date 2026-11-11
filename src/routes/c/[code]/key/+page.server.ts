import { getBank, openClass } from '#lib/server/app.ts';
import { chipColour, topicColours } from '#lib/palette.ts';

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	const bank = getBank(doc.course);
	const skills = new Map(bank.skills.map((s) => [s.id, s]));
	const colours = topicColours(bank.skills);
	return {
		code,
		lesson: doc.doNow?.lesson ?? null,
		title: doc.doNow?.title ?? '',
		items: (doc.doNow?.items ?? []).map((it, i) => {
			const skill = skills.get(it.skillId);
			const colour = colours.get(skill?.topic ?? '');
			return {
				n: i + 1,
				chip: chipColour(i),
				tint: colour?.tint ?? '#ECE8FB',
				prompt: it.question.prompt,
				answer: it.question.answer,
				status: it.question.status,
				reason: it.reason,
				skill: skill?.title ?? it.skillId,
				topic: skill?.topic ?? '',
				specRefs: skill?.specRefs ?? []
			};
		})
	};
}
