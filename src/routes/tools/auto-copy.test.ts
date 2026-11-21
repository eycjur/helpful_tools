import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import NotionPage from './markdown-to-notion/+page.svelte';
import TransposePage from './clipboard-table-transpose/+page.svelte';

it.each([
	{ mount: () => render(NotionPage), input: '甲\n乙', expected: '甲\n\n乙', selector: 'pre' },
	{
		mount: () => render(TransposePage),
		input: '甲\t乙\n丙\t丁',
		expected: '甲\t丙\n乙\t丁',
		selector: 'textarea[readonly]'
	}
])(
	'Clipboard APIがなくても $selector に変換結果を表示する',
	async ({ mount, input, expected, selector }) => {
		expect(navigator.clipboard).toBeUndefined();
		const { container } = mount();
		await fireEvent.input(container.querySelector('textarea')!, { target: { value: input } });
		await waitFor(() => {
			const output = container.querySelector(selector);
			expect(output instanceof HTMLTextAreaElement ? output.value : output?.textContent).toBe(
				expected
			);
		});
	}
);
