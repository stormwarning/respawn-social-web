import { defineLexiconConfig } from '@atcute/lex-cli'

export default defineLexiconConfig({
	generate: {
		files: ['../../packages/lexicons/lexicons/**/*.json'],
		outdir: 'src/lib/lexicons/',
	},
})
