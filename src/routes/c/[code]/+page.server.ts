import { fail } from '@sveltejs/kit';
import { getBank, getCourse, getStore, openClass } from '#lib/server/app.ts';
import { formString } from '#lib/server/form.ts';
import { chipColour, topicColours } from '#lib/palette.ts';
import { DEFAULT_CONFIG, generateDoNow, markTaught, unmarkTaught } from '#lib/scheduler.ts';

type Event = { params: { code: string }; request: Request };

export function load({ params }: { params: { code: string } }) {
	const { code, doc } = openClass(params.code);
	const bank = getBank(doc.course);
	const colours = topicColours(bank.skills);
	return {
		code,
		course: getCourse(doc.course).name,
		lesson: doc.state.lesson,
		size: doc.size,
		doNowLesson: doc.doNow?.lesson ?? null,
		doNowTitle: doc.doNow?.title ?? '',
		doNowItems: (doc.doNow?.items ?? []).map((it, i) => ({
			n: i + 1,
			prompt: it.question.prompt,
			chip: chipColour(i)
		})),
		topics: [...colours].map(([name, colour]) => ({ name, ...colour })),
		skills: bank.skills.map((s) => ({
			id: s.id,
			title: s.title,
			topic: s.topic,
			specRefs: s.specRefs,
			questions: s.questions.length,
			taught: Object.hasOwn(doc.state.taught, s.id),
			practised: s.questions.filter((q) => (doc.state.questions[q.id]?.practices ?? 0) > 0).length
		}))
	};
}

export const actions = {
	// Each action reads the class only after awaiting the body, so concurrent posts
	// (e.g. ticking several skills quickly) cannot overwrite each other's changes.
	toggle: async ({ params, request }: Event) => {
		const form = await request.formData();
		const { code, doc } = openClass(params.code);
		const skillId = formString(form, 'skill');
		try {
			const state =
				form.get('taught') === '1'
					? markTaught(getBank(doc.course), doc.state, skillId)
					: unmarkTaught(getBank(doc.course), doc.state, skillId);
			getStore().save(code, { ...doc, state });
		} catch {
			return fail(400, { message: `Unknown skill: ${skillId}` });
		}
	},
	size: async ({ params, request }: Event) => {
		const size = Number((await request.formData()).get('size'));
		const { code, doc } = openClass(params.code);
		if (!Number.isInteger(size) || size < 4 || size > 6)
			return fail(400, { message: 'A Do Now has 4 to 6 questions.' });
		getStore().save(code, { ...doc, size });
	},
	generate: async ({ params, request }: Event) => {
		const title = formString(await request.formData(), 'title')
			.trim()
			.slice(0, 120);
		const { code, doc } = openClass(params.code);
		if (Object.keys(doc.state.taught).length === 0) {
			return fail(400, { message: 'Tick at least one skill you have taught first.' });
		}
		const { state, doNow } = generateDoNow(getBank(doc.course), doc.state, {
			...DEFAULT_CONFIG,
			size: doc.size
		});
		getStore().save(code, { ...doc, state, doNow: { ...doNow, title } });
	}
};
