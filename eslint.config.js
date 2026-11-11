import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	{ ignores: ['build/', '.svelte-kit/', 'node_modules/', 'prototypes/', 'bank/'] },
	js.configs.recommended,
	...ts.configs.strictTypeChecked,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				projectService: { allowDefaultProject: ['*.ts'] },
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
			'@typescript-eslint/no-confusing-void-expression': 'off'
		}
	},
	{
		// node:test registers top-level test() promises with the runner itself.
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-floating-promises': [
				'error',
				{
					allowForKnownSafeCalls: [
						{ from: 'package', package: 'node:test', name: ['test', 'it', 'describe', 'suite'] }
					]
				}
			]
		}
	},
	{ files: ['**/*.js'], extends: [ts.configs.disableTypeChecked] }
);
