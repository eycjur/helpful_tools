import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EncoderPage from './+page.svelte';

describe('HTML/URLエンコーダ', () => {
	it('入力をプレビューし、交換した出力を上書きせずにデコードする', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

		try {
			render(EncoderPage);
			const [input, output] = screen.getAllByRole<HTMLTextAreaElement>('textbox');

			await fireEvent.input(input, { target: { value: '&lt; 😀' } });
			expect(output.value).toBe('&amp;lt; 😀');

			await fireEvent.click(screen.getByRole('button', { name: '入出力交換' }));
			expect(input.value).toBe('&amp;lt; 😀');
			expect(output.value).toBe('&lt; 😀');

			await fireEvent.click(screen.getByRole('button', { name: 'デコード' }));
			expect(output.value).toBe('&lt; 😀');
			expect(writeText).toHaveBeenCalledWith('&lt; 😀');
		} finally {
			if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
			else Reflect.deleteProperty(navigator, 'clipboard');
		}
	});
});
