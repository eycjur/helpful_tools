import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('exifr', () => ({
	parse: vi.fn().mockResolvedValue({ Make: 'Test Camera' }),
	gps: vi.fn().mockResolvedValue({ latitude: 0, longitude: 139 })
}));
vi.mock('./ai-detector', () => ({
	loadC2paProvenance: vi.fn().mockResolvedValue({ hasManifest: false, isAiGenerated: false }),
	getActionLabel: vi.fn(),
	formatSoftwareAgent: vi.fn()
}));

afterEach(() => vi.unstubAllGlobals());

function mockImage() {
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn(() => 'blob:photo');
			static revokeObjectURL = vi.fn();
		}
	);
	vi.stubGlobal(
		'Image',
		class {
			naturalWidth = 1;
			naturalHeight = 1;
			onload?: () => void;
			set src(_url: string) {
				queueMicrotask(() => this.onload?.());
			}
		}
	);
}

it('links to GPS coordinates on the equator', async () => {
	mockImage();
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
	await fireEvent.change(input, { target: { files: [file] } });
	await screen.findByText('GPS情報');
	const link = screen
		.getAllByRole<HTMLAnchorElement>('link')
		.find((item) => item.href.includes('google.com/maps'));
	expect(link?.href).toBe('https://www.google.com/maps?q=0,139');
});

it('keeps only full metadata removal available for formats without C2PA-only removal', async () => {
	mockImage();
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	await fireEvent.change(input, {
		target: { files: [new File(['test'], 'photo.webp', { type: 'image/webp' })] }
	});
	await fireEvent.click(await screen.findByRole('button', { name: 'メタデータ削除' }));

	const only = screen.getByRole<HTMLButtonElement>('button', { name: 'C2PAメタデータを削除' });
	const all = screen.getByRole<HTMLButtonElement>('button', { name: '全メタデータを削除' });
	expect(only.disabled).toBe(true);
	expect(all.disabled).toBe(false);
	expect(screen.getByText(/「全メタデータを削除」を選んでください/)).toBeTruthy();

	await fireEvent.change(input, {
		target: { files: [new File(['test'], 'photo.png', { type: 'image/png' })] }
	});
	const enabled = await screen.findByRole<HTMLButtonElement>('button', {
		name: 'C2PAメタデータを削除'
	});
	expect(enabled.disabled).toBe(false);
});

it.each([
	[-1, false],
	[0, true],
	[1, true]
])('checks the large-image warning at 50 MiB plus %i bytes', async (offset, expected) => {
	mockImage();
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	const file = new File(['test'], 'photo.png', { type: 'image/png' });
	Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + offset });
	await fireEvent.change(input, { target: { files: [file] } });
	await screen.findByText('GPS情報');
	expect(Boolean(screen.queryByText(/ファイルサイズが大きいため/))).toBe(expected);
});
