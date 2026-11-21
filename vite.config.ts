import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		// FFmpegはパッケージ内の相対URLからWorkerを読み込む。
		exclude: ['@ffmpeg/ffmpeg']
	}
});
