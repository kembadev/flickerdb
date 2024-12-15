import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config({
	ignores: ['lib/*/**'],
	extends: [
		pluginJs.configs.recommended,
		...tseslint.configs.recommended,
		eslintPluginPrettierRecommended,
	],
	languageOptions: {
		ecmaVersion: 2020,
		globals: globals.node,
	},
	files: ['**/*.{js,ts}'],
	rules: {
		'prettier/prettier': [
			'error',
			{
				endOfLine: 'auto',
			},
		],
	},
});
