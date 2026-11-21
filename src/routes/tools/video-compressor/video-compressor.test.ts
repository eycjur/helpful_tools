import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLCanvasElement.prototype, 'captureStream');
});

it('draws the first decoded frame before starting the canvas stream', async () => {
	const events: string[] = [];
	let nextFrame: FrameRequestCallback = () => {};
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		nextFrame = callback;
		return 1;
	});
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn(() => 'blob:video');
			static revokeObjectURL = vi.fn();
		}
	);
	vi.stubGlobal(
		'MediaRecorder',
		class {
			static isTypeSupported(type: string) {
				return type === 'video/webm';
			}
			state = 'inactive';
			ondataavailable?: (event: { data: Blob }) => void;
			onstop?: () => void;
			start() {
				events.push('record');
				this.state = 'recording';
			}
			stop() {
				this.state = 'inactive';
				this.ondataavailable?.({ data: new Blob(['movie'], { type: 'video/webm' }) });
				this.onstop?.();
			}
		}
	);
	vi.stubGlobal(
		'AudioContext',
		class {
			destination = {};
			createMediaElementSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
			createMediaStreamDestination = vi.fn(() => ({
				stream: { getAudioTracks: () => [], getTracks: () => [] }
			}));
			close = vi.fn().mockResolvedValue(undefined);
		}
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
		drawImage: () => events.push('draw')
	} as unknown as CanvasRenderingContext2D);
	Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
		configurable: true,
		value: () => {
			events.push('capture');
			return { getTracks: () => [] };
		}
	});
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {
		events.push('play');
	});
	vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
	vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
	const ended = vi.spyOn(HTMLMediaElement.prototype, 'ended', 'get').mockReturnValue(false);
	vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(1);
	vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(96);
	vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(64);

	const { container } = render(Page);
	await fireEvent.change(container.querySelector('input[type="file"]')!, {
		target: { files: [new File(['test'], 'movie.webm', { type: 'video/webm' })] }
	});
	await fireEvent.loadedMetadata(container.querySelector('video')!);
	await fireEvent.click(screen.getByRole('button', { name: '動画を圧縮' }));
	await waitFor(() => expect(events.slice(0, 4)).toEqual(['play', 'draw', 'capture', 'record']));
	ended.mockReturnValue(true);
	nextFrame(16);
	await screen.findByRole('button', { name: 'ダウンロード' });
});
