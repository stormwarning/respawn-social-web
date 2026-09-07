/** @type {import('stylelint').Config} */
export default {
	extends: ['@zazen/stylelint-config'],

	ignoreFiles: [
		'**/node_modules/**',
		'**/.svelte-kit/**',
		'**/.netlify/**',
		'**/.delta/**',
		'**/build/**',
		'**/dist/**',
	],

	rules: {
		/**
		 * @todo Suggest adding this to upstream config.
		 */
		'import-notation': 'string',

		/**
		 * @todo Update this in upstream config.
		 */
		'order/order': [
			'dollar-variables',
			'custom-properties',
			{
				type: 'at-rule',
				name: 'extend',
			},
			{
				type: 'at-rule',
				name: 'include',
				hasBlock: false,
			},
			'declarations',
			{
				type: 'at-rule',
				hasBlock: true,
			},
			{
				type: 'rule',
				selector: /^&::/,
			},
			'rules',
			{
				type: 'rule',
				selector: /^&:[^:]/,
			},
			{
				type: 'rule',
				selector: /^&[.[#]/,
			},
		],
	},

	overrides: [
		{
			files: ['**/*.svelte'],
			customSyntax: 'postcss-html',
			rules: {
				/**
				 * Components without a `<style>` block yield an empty source.
				 * @see https://stylelint.io/user-guide/rules/no-empty-source
				 */
				'no-empty-source': null,

				/**
				 * Svelte scopes styles with the `:global()` pseudo-class.
				 * @see https://svelte.dev/docs/svelte/global-styles
				 */
				'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
			},
		},
	],
}
