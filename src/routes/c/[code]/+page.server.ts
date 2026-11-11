import { fail } from '@sveltejs/kit';
import { getBank, getCourse, getStore, openClass } from '#lib/server/app.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, unmarkTaught } from '#lib/scheduler.ts';

type Event = { params: { code: string }; request: Request };

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	return {
		code,
		course: getCourse(doc.course).name,
		lesson: doc.state.lesson,
		size: doc.size,
		doNowLesson: doc.doNow?.lesson ?? null,
		skills: getBank(doc.course).skills.map((s) => ({
			id: s.id,
			title: s.title,
			topic: s.topic,
			specRefs: s.specRefs,
			questions: s.questions.length,
			taught: Object.hasOwn(doc.state.skills, s.id),
			practices: doc.state.skills[s.id]?.practices ?? 0
		}))
	};
}

export const actions = {
	toggle: async ({ params, request }: Event) => {
		const { code, doc } = openClass(params.code);
		const form = await request.formData();
		const skillId = String(form.get('skill') ?? '');
		try {
			const state =
				form.get('taught') === '1'
					? markTaught(getBank(doc.course), doc.state, skillId)
					: unmarkTaught(doc.state, skillId);
			getStore().save(code, { ...doc, state });
		} catch {
			return fail(400, { message: `Unknown skill: ${skillId}` });
		}
	},
	size: async ({ params, request }: Event) => {
		const { code, doc } = openClass(params.code);
		const size = Number((await request.formData()).get('size'));
		if (!Number.isInteger(size) || size < 4 || size > 6)
			return fail(400, { message: 'A Do Now has 4 to 6 questions.' });
		getStore().save(code, { ...doc, size });
	},
	generate: async ({ params, request }: Event) => {
		const { code, doc } = openClass(params.code);
		if (Object.keys(doc.state.skills).length === 0) {
			return fail(400, { message: 'Tick at least one skill you have taught first.' });
		}
		const title = String((await request.formData()).get('title') ?? '')
			.trim()
			.slice(0, 120);
		const { state, doNow } = generateDoNow(getBank(doc.course), doc.state, {
			...DEFAULT_CONFIG,
			size: doc.size
		});
		getStore().save(code, { ...doc, state, doNow: { ...doNow, title } });
	}
};
