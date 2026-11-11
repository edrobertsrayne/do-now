import { openClass } from '#lib/server/app.ts';

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	return {
		code,
		lesson: doc.doNow?.lesson ?? null,
		title: doc.doNow?.title ?? '',
		items: (doc.doNow?.items ?? []).map((it, i) => ({ n: i + 1, prompt: it.question.prompt }))
	};
}
