import { describe, it, expect } from 'vitest';
import { customFrom, LEVEL_KEYS, LEVELS, resolveSettings } from './levels';

describe('LEVELS', () => {
	it('レベルが上がるほど解像度の上限と品質が下がる（または同じ）', () => {
		const images = LEVEL_KEYS.map((k) => LEVELS[k].settings.images).filter((i) => i !== null);
		for (let i = 1; i < images.length; i++) {
			expect(images[i].maxPpi!).toBeLessThanOrEqual(images[i - 1].maxPpi!);
			expect(images[i].quality).toBeLessThanOrEqual(images[i - 1].quality);
		}
	});

	it('「画質を維持」は画像を再圧縮せず、どのレベルも添付ファイルは消さない', () => {
		expect(LEVELS.lossless.settings.images).toBeNull();
		for (const k of LEVEL_KEYS) expect(LEVELS[k].settings.removeAttachments).toBe(false);
	});
});

describe('customFrom / resolveSettings', () => {
	it('カスタムで編集しても元のレベル定義を変えない', () => {
		const custom = customFrom('medium');
		custom.images.quality = 0.1;
		custom.extras.removeMetadata = true;
		expect(LEVELS.medium.settings.images!.quality).toBe(0.75);
		expect(LEVELS.medium.settings.removeMetadata).toBe(false);
	});

	it('「画質を維持」を元にしたカスタムは画像の再圧縮が無効で、有効にすると初期値が入っている', () => {
		const custom = customFrom('lossless');
		expect(custom.recompressImages).toBe(false);
		expect(resolveSettings('custom', custom).images).toBeNull();
		custom.recompressImages = true;
		expect(resolveSettings('custom', custom).images?.maxPpi).toBe(150);
	});

	it('レベル選択時はレベルの設定、カスタム時は編集した値を文字列も数値にして返す', () => {
		const custom = customFrom('high');
		expect(resolveSettings('high', custom)).toBe(LEVELS.high.settings);
		(custom.images as unknown as { quality: string }).quality = '0.5';
		(custom.images as unknown as { maxPpi: string }).maxPpi = '72';
		const resolved = resolveSettings('custom', custom);
		expect(resolved.images).toMatchObject({ quality: 0.5, maxPpi: 72, jpegGray: true });
		expect(resolved.removeThumbnails).toBe(true);
	});
});
