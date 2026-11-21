import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		paths: { base: dev ? '' : '/helpful_tools' },
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			precompress: false,
			strict: true
		})
	}
};

export default config;
