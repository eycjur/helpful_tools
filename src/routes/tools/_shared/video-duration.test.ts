import { expect, it } from 'vitest';
import { formatVideoDuration } from './video-duration';

it('shows an unknown duration until the browser knows the video length', () => {
	expect(formatVideoDuration(Infinity)).toBe('—');
	expect(formatVideoDuration(NaN)).toBe('—');
});

it('formats finite video lengths without fractional seconds', () => {
	expect(formatVideoDuration(0)).toBe('0:00');
	expect(formatVideoDuration(65.5)).toBe('1:05');
});
