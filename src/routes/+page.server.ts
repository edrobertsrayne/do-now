import { fail, redirect } from '@sveltejs/kit';
import { generateCode, normaliseCode } from '$lib/server/classCode.ts';
import { getStore, newDoc } from '$lib/server/app.ts';

export const actions = {
	create: async () => {
		const store = getStore();
		let code = generateCode();
		while (!store.create(code, newDoc())) code = generateCode();
		redirect(303, `/c/${code}`);
	},
	join: async ({ request }: { request: Request }) => {
		const raw = String((await request.formData()).get('code') ?? '');
		const code = normaliseCode(raw);
		if (!code || !getStore().get(code))
			return fail(404, { message: 'No class with that code.', code: raw });
		redirect(303, `/c/${code}`);
	}
};
