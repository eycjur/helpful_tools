<script lang="ts">
	import {
		CATEGORY_LABELS,
		type ImageInfo,
		type SpaceCategory,
		type SpaceReport
	} from './pdf-optimizer';
	import { formatSize } from './format';

	let { before, after }: { before: SpaceReport; after: SpaceReport | null } = $props();

	const MAX_IMAGE_ROWS = 10;

	const bytesOf = (report: SpaceReport | null, c: SpaceCategory) =>
		report?.categories.find((x) => x.category === c)?.bytes ?? 0;
	const totalOf = (report: SpaceReport) => report.categories.reduce((s, c) => s + c.bytes, 0);

	// 圧縮前の容量が大きい順。圧縮後にだけ現れた区分も末尾に含める
	const rows = $derived.by(() => {
		const keys = before.categories.map((c) => c.category);
		for (const c of after?.categories ?? []) if (!keys.includes(c.category)) keys.push(c.category);
		return keys.map((category) => ({
			category,
			before: bytesOf(before, category),
			after: after ? bytesOf(after, category) : null
		}));
	});
	const maxBytes = $derived(Math.max(1, ...rows.map((r) => Math.max(r.before, r.after ?? 0))));
	const unembeddedFonts = $derived(before.fonts.filter((f) => !f.embedded).length);
	const nonSubsetFonts = $derived(before.fonts.filter((f) => f.embedded && !f.subset).length);

	function reduction(b: number, a: number): string {
		if (b === 0) return '—';
		const pct = (1 - a / b) * 100;
		return pct >= 0 ? `−${pct.toFixed(0)}%` : `+${(-pct).toFixed(0)}%`;
	}
</script>

{#snippet imageTable(images: ImageInfo[])}
	<div class="mt-2 overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead class="text-gray-500">
				<tr>
					<th class="py-1 pr-2">ピクセル</th>
					<th class="py-1 pr-2">形式</th>
					<th class="py-1 pr-2">色空間</th>
					<th class="py-1 pr-2">容量</th>
					<th
						class="py-1"
						title="最も大きく描かれた箇所での解像度。—は描画箇所を特定できなかった画像">実効ppi</th
					>
				</tr>
			</thead>
			<tbody class="font-mono">
				{#each images.slice(0, MAX_IMAGE_ROWS) as img, i (i)}
					<tr class="border-t border-gray-100">
						<td class="py-1 pr-2">{img.width}×{img.height}</td>
						<td class="py-1 pr-2">{img.filter}</td>
						<td class="py-1 pr-2">{img.colorSpace}</td>
						<td class="py-1 pr-2">{formatSize(img.bytes)}</td>
						<td class="py-1">{img.effectivePpi ?? '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<section class="rounded-lg border border-gray-200 bg-white p-4">
	<h2 class="mb-1 font-semibold">容量の内訳{after ? '（圧縮前後）' : ''}</h2>
	<p class="mb-3 text-xs text-gray-600">
		PDF内のデータ量の目安です（ファイル全体のサイズとは一致しません）。
	</p>
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="text-left text-xs text-gray-500">
				<tr>
					<th class="py-1 pr-2 font-normal">区分</th>
					<th class="py-1 pr-2 text-right font-normal">圧縮前</th>
					{#if after}
						<th class="py-1 pr-2 text-right font-normal">圧縮後</th>
						<th class="py-1 pr-2 text-right font-normal">増減</th>
					{/if}
					<th class="w-1/3 py-1 font-normal"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.category)}
					<tr class="border-t border-gray-100">
						<td class="py-1.5 pr-2">{CATEGORY_LABELS[r.category]}</td>
						<td class="py-1.5 pr-2 text-right font-mono text-gray-700">{formatSize(r.before)}</td>
						{#if r.after !== null}
							<td class="py-1.5 pr-2 text-right font-mono text-gray-700">{formatSize(r.after)}</td>
							<td class="py-1.5 pr-2 text-right font-mono text-gray-600"
								>{reduction(r.before, r.after)}</td
							>
						{/if}
						<td class="py-1.5">
							<div class="space-y-0.5">
								<div
									class="h-1.5 rounded bg-gray-400"
									style="width: {(r.before / maxBytes) * 100}%"
								></div>
								{#if r.after !== null}
									<div
										class="h-1.5 rounded bg-blue-500"
										style="width: {(r.after / maxBytes) * 100}%"
									></div>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
				<tr class="border-t border-gray-300 font-medium">
					<td class="py-1.5 pr-2">合計</td>
					<td class="py-1.5 pr-2 text-right font-mono">{formatSize(totalOf(before))}</td>
					{#if after}
						<td class="py-1.5 pr-2 text-right font-mono">{formatSize(totalOf(after))}</td>
						<td class="py-1.5 pr-2 text-right font-mono"
							>{reduction(totalOf(before), totalOf(after))}</td
						>
					{/if}
					<td></td>
				</tr>
			</tbody>
		</table>
	</div>
	{#if after}
		<p class="mt-1 flex gap-4 text-xs text-gray-500">
			<span class="flex items-center gap-1"
				><span class="inline-block h-1.5 w-4 rounded bg-gray-400"></span>圧縮前</span
			>
			<span class="flex items-center gap-1"
				><span class="inline-block h-1.5 w-4 rounded bg-blue-500"></span>圧縮後</span
			>
		</p>
	{/if}

	{#if before.images.length > 0}
		<details class="mt-3">
			<summary class="cursor-pointer text-sm font-medium">
				圧縮前の画像 {before.images.length}個（容量の大きい順）
			</summary>
			{@render imageTable(before.images)}
		</details>
	{/if}
	{#if after && after.images.length > 0}
		<details class="mt-2">
			<summary class="cursor-pointer text-sm font-medium">
				圧縮後の画像 {after.images.length}個（容量の大きい順）
			</summary>
			{@render imageTable(after.images)}
		</details>
	{/if}

	{#if unembeddedFonts > 0 || nonSubsetFonts > 0}
		<p class="mt-3 text-xs text-gray-600">
			フォント: 未埋め込み {unembeddedFonts}個・サブセット化されていない埋め込み {nonSubsetFonts}個。
			{#if nonSubsetFonts > 0}フォントが大きい場合は、作成元のアプリでサブセット埋め込みにして出力し直すと効果的です。{/if}
		</p>
	{/if}
</section>
