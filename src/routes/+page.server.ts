import { fail, redirect } from '@sveltejs/kit';
import { generateCode, normaliseCode } from '#lib/server/classCode.ts';
import { getLibrary, getStore, newDoc } from '#lib/server/app.ts';
import { formString } from '#lib/server/form.ts';

export function load() {
	return { courses: getLibrary().courses.map((c) => ({ id: c.id, name: c.name })) };
}

export const actions = {
	create: async ({ request }: { request: Request }) => {
		const course = formString(await request.formData(), 'course');
		if (!getLibrary().courses.some((c) => c.id === course))
			return fail(400, { message: 'Choose a course.', code: '' });
		const store = getStore();
		let code = generateCode();
		while (!store.create(code, newDoc(course))) code = generateCode();
		redirect(303, `/c/${code}`);
	},
	join: async ({ request }: { request: Request }) => {
		const raw = formString(await request.formData(), 'code');
		const code = normaliseCode(raw);
		if (!code || !getStore().get(code))
			return fail(404, { message: 'No class with that code.', code: raw });
		redirect(303, `/c/${code}`);
	}
};
