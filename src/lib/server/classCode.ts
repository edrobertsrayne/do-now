import { randomInt } from 'node:crypto';

/** 31 characters: A-Z without I, L, O, plus 2-9 (no 0 or 1). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function generateCode(): string {
	let code = '';
	for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
	return code;
}

/** Upper-case and strip spaces/dashes; null if the result is not a well-formed code. */
export function normaliseCode(input: string): string | null {
	const code = input.toUpperCase().replace(/[\s-]/g, '');
	return CODE_RE.test(code) ? code : null;
}
