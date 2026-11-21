import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import SymbolSearchPage from './+page.svelte';

describe('記号検索', () => {
	it('読みの長音は省略でき、長音だけの検索を空欄と区別する', async () => {
		render(SymbolSearchPage);
		const search = screen.getByRole('textbox');

		await fireEvent.input(search, { target: { value: 'いこる' } });
		expect(screen.getByRole('button', { name: '等号（イコール）' })).toBeDefined();

		await fireEvent.input(search, { target: { value: 'ー' } });
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText(/該当する記号が見つかりませんでした/)).toBeDefined();
	});
});
