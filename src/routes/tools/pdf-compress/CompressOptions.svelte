<script lang="ts">
	import { customFrom, LEVEL_KEYS, LEVELS, type CustomSettings, type LevelKey } from './levels';

	let {
		level = $bindable(),
		custom = $bindable()
	}: { level: LevelKey | 'custom'; custom: CustomSettings } = $props();

	/** カスタムを開いたときは、直前に選んでいたレベルの設定を初期値にする */
	function selectLevel(next: LevelKey | 'custom') {
		if (next === 'custom' && level !== 'custom') custom = customFrom(level);
		level = next;
	}

	const PPI_OPTIONS: { value: number | null; label: string }[] = [
		{ value: null, label: '縮小しない' },
		{ value: 300, label: '300 ppi（印刷向け）' },
		{ value: 200, label: '200 ppi' },
		{ value: 150, label: '150 ppi（画面・配布向け）' },
		{ value: 96, label: '96 ppi' },
		{ value: 72, label: '72 ppi' },
		{ value: 50, label: '50 ppi（最大圧縮）' }
	];
	const QUALITY_OPTIONS = [
		{ value: 0.3, label: '0.3（最大圧縮）' },
		{ value: 0.4, label: '0.4' },
		{ value: 0.5, label: '0.5' },
		{ value: 0.6, label: '0.6' },
		{ value: 0.75, label: '0.75' },
		{ value: 0.85, label: '0.85' },
		{ value: 0.92, label: '0.92（高画質）' }
	];
</script>

<fieldset class="space-y-1">
	<legend class="mb-1 text-sm font-medium">圧縮レベル</legend>
	{#each [...LEVEL_KEYS, 'custom' as const] as key (key)}
		<label class="flex flex-wrap items-baseline gap-x-2 text-sm">
			<input type="radio" name="level" checked={level === key} onchange={() => selectLevel(key)} />
			<span>{key === 'custom' ? 'カスタム' : LEVELS[key].label}</span>
			<span class="text-xs text-gray-600"
				>{key === 'custom' ? '項目ごとに調整' : LEVELS[key].note}</span
			>
		</label>
	{/each}
</fieldset>

{#if level === 'custom'}
	<div class="mt-3 space-y-4 rounded border border-gray-200 bg-gray-50 p-3">
		<fieldset class="space-y-2">
			<legend class="text-sm font-medium">画像</legend>
			<label class="flex items-center gap-2 text-sm">
				<input type="radio" bind:group={custom.recompressImages} value={false} />
				画質を維持（画像は再圧縮しない）
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="radio" bind:group={custom.recompressImages} value={true} />
				再圧縮する
			</label>
			{#if custom.recompressImages}
				<div class="space-y-2 pl-6">
					<div class="flex flex-wrap gap-4">
						<div>
							<label for="max-ppi" class="mb-1 block text-xs text-gray-600">解像度の上限</label>
							<select
								id="max-ppi"
								bind:value={custom.images.maxPpi}
								class="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
							>
								{#each PPI_OPTIONS as o (o.value)}
									<option value={o.value}>{o.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="image-quality" class="mb-1 block text-xs text-gray-600">JPEG品質</label>
							<select
								id="image-quality"
								bind:value={custom.images.quality}
								class="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
							>
								{#each QUALITY_OPTIONS as o (o.value)}
									<option value={o.value}>{o.label}</option>
								{/each}
							</select>
						</div>
					</div>
					<label class="flex items-start gap-2 text-sm">
						<input type="checkbox" bind:checked={custom.images.jpegGray} class="mt-1" />
						<span>
							グレースケール画像もJPEGにする<br />
							<span class="text-xs text-gray-600"
								>カラーのJPEGになるため、印刷時に黒がK版のみでなくなります</span
							>
						</span>
					</label>
					<label class="flex items-start gap-2 text-sm">
						<input type="checkbox" bind:checked={custom.images.jpegFewColors} class="mt-1" />
						<span>
							スクリーンショット・図（色数の少ない画像）もJPEGにする<br />
							<span class="text-xs text-gray-600">文字や線の周りがにじむことがあります</span>
						</span>
					</label>
					<p class="text-xs text-gray-600">
						解像度の上限は紙面に描かれた大きさでの値で、同じ画像が複数箇所にあれば最も大きい箇所に合わせます。透明度マスクは可逆のまま縮小し、CMYK等の画像は対象外です。
					</p>
				</div>
			{/if}
		</fieldset>

		<fieldset class="space-y-1">
			<legend class="text-sm font-medium">フォント・付加データ（見た目は変わりません）</legend>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={custom.extras.removeThumbnails} />ページのサムネイル
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={custom.extras.removePieceInfo}
				/>作成アプリの編集用データ（PieceInfo）
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={custom.extras.removeMetadata}
				/>XMPメタデータ（作成者・作成ツール等の詳細情報）
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={custom.extras.subsetFonts}
				/>フォントを使用文字だけにする（まるごと埋め込まれたフォント）
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={custom.extras.removeAttachments}
				/>添付ファイル（文書レベル）
			</label>
		</fieldset>
	</div>
{/if}
