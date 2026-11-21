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

it('links to GPS coordinates on the equator', async () => {
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
