import { describe, expect, it } from 'vitest';
import { calculateAspectRatioConstrainedSize } from './video-size';

describe('calculateAspectRatioConstrainedSize', () => {
	it('keeps tiny videos at their original dimensions', () => {
		expect(calculateAspectRatioConstrainedSize(4, 4, 3840, 2160)).toEqual({ width: 4, height: 4 });
	});

	it('stays within the requested limits for landscape and portrait video', () => {
		expect(calculateAspectRatioConstrainedSize(1920, 1080, 999, 999)).toEqual({
			width: 999,
			height: 562
		});
		expect(calculateAspectRatioConstrainedSize(1080, 1920, 999, 999)).toEqual({
			width: 562,
			height: 999
		});
	});

	it('keeps the shorter side at least one pixel wide', () => {
		expect(calculateAspectRatioConstrainedSize(1, 2000, 1, 100)).toEqual({
			width: 1,
			height: 100
		});
	});
});
