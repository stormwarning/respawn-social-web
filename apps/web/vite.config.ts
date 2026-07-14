import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],
	// Bind dev server to 127.0.0.1 so it matches the OAuth loopback redirect URI
	// (http://127.0.0.1:5173/oauth/callback). Avoids the localhost↔127.0.0.1 hop.
	server: { host: '127.0.0.1' },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['./src/vitest-setup.ts'],
	},
})
