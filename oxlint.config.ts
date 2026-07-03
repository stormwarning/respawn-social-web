import { defineConfig } from 'oxlint'

export default defineConfig({
	$schema: './node_modules/oxlint/configuration_schema.json',
	env: { node: true, browser: true, es2024: true },
	plugins: ['typescript', 'unicorn', 'oxc', 'import'],
	categories: {
		correctness: 'error',
		suspicious: 'warn',
		perf: 'warn',
	},
	ignorePatterns: [
		'.svelte-kit/',
		'build/',
		'node_modules/',
		// Codegen output (@atproto/lex).
		'packages/lexicons/src/lexicons/',
	],
	rules: {
		'no-console': 'off',
		// CSS/side-effect imports (e.g. `import '../app.css'`) are intentional.
		'import/no-unassigned-import': 'off',
		// `export {};` in app.d.ts is the idiomatic SvelteKit ambient-module marker.
		'unicorn/require-module-specifiers': 'off',
	},
})
