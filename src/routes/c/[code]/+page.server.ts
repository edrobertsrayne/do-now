import { fail } from '@sveltejs/kit';
import { getBank, getStore, openClass } from '$lib/server/app.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, unmarkTaught } from '$lib/scheduler.ts';

type Event = { params: { code: string }; request: Request };

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	return {
		code,
		lesson: doc.state.lesson,
		size: doc.size,
		doNowLesson: doc.doNow?.lesson ?? null,
		skills: getBank().skills.map((s) => ({
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
				form.get('taught') === '1' ? markTaught(getBank(), doc.state, skillId) : unmarkTaught(doc.state, skillId);
			getStore().save(code, { ...doc, state });
		} catch {
			return fail(400, { message: `Unknown skill: ${skillId}` });
		}
	},
	size: async ({ params, request }: Event) => {
		const { code, doc } = openClass(params.code);
		const size = Number((await request.formData()).get('size'));
		if (!Number.isInteger(size) || size < 4 || size > 6) return fail(400, { message: 'A Do Now has 4 to 6 questions.' });
		getStore().save(code, { ...doc, size });
	},
	generate: async ({ params }: Event) => {
		const { code, doc } = openClass(params.code);
		if (Object.keys(doc.state.skills).length === 0) {
			return fail(400, { message: 'Tick at least one skill you have taught first.' });
		}
		const { state, doNow } = generateDoNow(getBank(), doc.state, { ...DEFAULT_CONFIG, size: doc.size });
		getStore().save(code, { ...doc, state, doNow });
	}
};
