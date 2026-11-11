/** A text field from submitted form data; '' when missing or a file upload. */
export function formString(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
}
