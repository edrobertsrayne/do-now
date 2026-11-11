import { openClass } from '$lib/server/app.ts';

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	return {
		code,
		items: (doc.doNow?.items ?? []).map((it, i) => ({ n: i + 1, prompt: it.question.prompt, answer: it.question.answer }))
	};
}
