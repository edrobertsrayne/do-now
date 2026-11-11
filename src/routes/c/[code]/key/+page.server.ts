import { getBank, openClass } from '#lib/server/app.ts';

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	const skills = new Map(getBank(doc.course).skills.map((s) => [s.id, s]));
	return {
		code,
		lesson: doc.doNow?.lesson ?? null,
		items: (doc.doNow?.items ?? []).map((it, i) => {
			const skill = skills.get(it.skillId);
			return {
				n: i + 1,
				command: it.question.command,
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
