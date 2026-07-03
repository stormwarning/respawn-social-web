import adapter from '@sveltejs/adapter-netlify'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Node runtime (not edge): @atproto/oauth-client-node needs Node APIs.
		adapter: adapter({ edge: false }),
	},
}

export default config
