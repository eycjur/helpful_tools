import { expect, it } from 'vitest';
import { isVideoFile, videoFileAccept } from './video-file';

it('accepts video file extensions even when the chooser has no specific MIME type', () => {
	for (const extension of ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv']) {
		expect(videoFileAccept.split(',')).toContain(extension);
		expect(isVideoFile({ name: `clip${extension.toUpperCase()}`, type: '' })).toBe(true);
	}
	expect(isVideoFile({ name: 'clip.mov', type: 'application/octet-stream' })).toBe(true);
	expect(isVideoFile({ name: 'clip', type: 'video/quicktime' })).toBe(true);
});

it('rejects non-video MIME types and unrecognized files without a known MIME', () => {
	expect(isVideoFile({ name: 'clip.mov', type: 'text/plain' })).toBe(false);
	expect(isVideoFile({ name: 'clip.mov.txt', type: '' })).toBe(false);
	expect(isVideoFile({ name: 'clip', type: 'application/octet-stream' })).toBe(false);
});
