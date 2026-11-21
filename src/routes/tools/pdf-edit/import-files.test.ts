import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { createPdfPageRenderer } from './pdf-first-page-image';

vi.mock('./pdf-first-page-image', () => ({ createPdfPageRenderer: vi.fn() }));

it.each(['成功', '失敗'])(
	'クリア後に読み込みが%sしても、残りのPDFを追加しない',
	async (outcome) => {
		const renderer = {
			pageCount: 1,
			hasFormsOrSignatures: false,
			renderPage: async () => 'blob:page',
			destroy: vi.fn().mockResolvedValue(undefined)
		};
		const pending = Promise.withResolvers<typeof renderer>();
		const load = vi.mocked(createPdfPageRenderer);
		load.mockReset().mockResolvedValueOnce(renderer).mockReturnValueOnce(pending.promise);
		const { container } = render(Page);
		const names = ['first.pdf', 'pending.pdf', 'queued.pdf'];
		const input = container.querySelector('input[type=file]')!;
		await fireEvent.change(input, {
			target: { files: names.map((name) => new File([], name, { type: 'application/pdf' })) }
		});
		await fireEvent.click(await screen.findByRole('button', { name: 'クリア' }));
		if (outcome === '成功') pending.resolve(renderer);
		else pending.reject(new Error('読み込み失敗'));
		await tick();
		expect(load).toHaveBeenCalledTimes(2);
		expect(renderer.destroy).toHaveBeenCalledTimes(outcome === '成功' ? 2 : 1);
		expect(screen.queryByText(/読み込み失敗/)).toBeNull();
		expect(screen.queryByRole('textbox', { name: '出力ファイル名' })).toBeNull();
	}
);
