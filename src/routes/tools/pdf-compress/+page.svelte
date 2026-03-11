<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { compressPdf, compressPdfEmbeddedImagesOnly } from '$lib/pdf-ops';

	const tool = tools.find((t) => t.name === 'pdf-compress');

	let compressFile: File | null = $state(null);
	let compressDragOver = $state(false);
	let isCompressing = $state(false);
	let compressResultUrl: string | null = $state(null);
	let compressOriginalSize = $state(0);
	let compressResultSize = $state(0);
	type CompressMode = 'structure' | 'embedded';
	let compressMode = $state<CompressMode>('structure');
	let imageQuality = $state(0.85);

	function formatSize(bytes: number): string {
		if (bytes === 0 || isNaN(bytes)) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function downloadBlob(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleCompressDrop(e: DragEvent) {
		e.preventDefault();
		compressDragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file?.type === 'application/pdf') {
			compressFile = file;
			compressOriginalSize = file.size;
			compressResultUrl = null;
		}
	}

	function handleCompressFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file?.type === 'application/pdf') {
			compressFile = file;
			compressOriginalSize = file.size;
			compressResultUrl = null;
		}
		(e.target as HTMLInputElement).value = '';
	}

	async function doCompress() {
		if (!compressFile) return;
		isCompressing = true;
		if (compressResultUrl) URL.revokeObjectURL(compressResultUrl);
		compressResultUrl = null;
		try {
			const result =
				compressMode === 'embedded'
					? await compressPdfEmbeddedImagesOnly(compressFile, { quality: Number(imageQuality) })
					: await compressPdf(compressFile);
			compressResultSize = result.length;
			compressResultUrl = URL.createObjectURL(
				new Blob([new Uint8Array(result)], { type: 'application/pdf' })
			);
		} catch (err) {
			alert('圧縮に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			isCompressing = false;
		}
	}

	function clearCompress() {
		compressFile = null;
		compressOriginalSize = 0;
		compressResultSize = 0;
		if (compressResultUrl) URL.revokeObjectURL(compressResultUrl);
		compressResultUrl = null;
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="space-y-4">
		<div
			role="region"
			aria-label="PDFファイルをドロップするエリア"
			class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {compressDragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				e.preventDefault();
				compressDragOver = true;
			}}
			ondragleave={() => (compressDragOver = false)}
			ondrop={handleCompressDrop}
		>
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				id="compress-input"
				onchange={handleCompressFileSelect}
			/>
			<label for="compress-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">PDFファイルをドラッグ＆ドロップ または クリックして選択</p>
			</label>
		</div>
		{#if compressFile}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="mb-2 font-medium">{compressFile.name}</p>
				<p class="mb-4 text-sm text-gray-600">元サイズ: {formatSize(compressOriginalSize)}</p>
				<div class="mb-4 space-y-3 rounded border border-gray-200 bg-white p-3">
					<fieldset class="space-y-2">
						<legend class="text-sm font-medium">圧縮モード</legend>
						<label class="flex cursor-pointer items-start gap-2">
							<input
								type="radio"
								bind:group={compressMode}
								value="structure"
								class="mt-1 rounded"
							/>
							<span>
								<strong>未使用オブジェクトの削除のみ</strong><br />
								<span class="text-xs text-gray-600">テキスト・ベクター・画像を維持</span>
							</span>
						</label>
						<label class="flex cursor-pointer items-start gap-2">
							<input type="radio" bind:group={compressMode} value="embedded" class="mt-1 rounded" />
							<span>
								<strong>未使用オブジェクトの削除と埋め込み画像の圧縮</strong><br />
								<span class="text-xs text-gray-600"
									>PDF内のJPEG/PNG画像をJPEGに変換して品質を下げて圧縮。テキスト・ベクター維持</span
								>
							</span>
						</label>
					</fieldset>
					{#if compressMode === 'embedded'}
						<div>
							<label for="image-quality" class="mb-1 block text-xs text-gray-600">JPEG品質</label>
							<select
								id="image-quality"
								bind:value={imageQuality}
								class="w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
							>
								<option value={0.6}>0.6（高圧縮）</option>
								<option value={0.75}>0.75</option>
								<option value={0.85}>0.85（推奨）</option>
								<option value={0.92}>0.92（高画質）</option>
								<option value={1}>1.0（最高画質）</option>
							</select>
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={doCompress}
						disabled={isCompressing}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{isCompressing ? '処理中...' : '圧縮する'}
					</button>
					<button
						type="button"
						onclick={clearCompress}
						class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
					>
						クリア
					</button>
				</div>
			</div>
		{/if}
		{#if compressResultUrl}
			<div
				class="rounded-lg border p-4 {compressResultSize < compressOriginalSize
					? 'border-green-200 bg-green-50'
					: 'border-amber-200 bg-amber-50'}"
			>
				<p
					class="mb-2 font-medium {compressResultSize < compressOriginalSize
						? 'text-green-800'
						: 'text-amber-800'}"
				>
					圧縮完了
				</p>
				<p class="mb-2 text-sm">
					元: {formatSize(compressOriginalSize)} → 圧縮後: {formatSize(compressResultSize)}
					{#if compressOriginalSize > 0 && compressResultSize < compressOriginalSize}
						（{((1 - compressResultSize / compressOriginalSize) * 100).toFixed(1)}%削減）
					{:else if compressResultSize >= compressOriginalSize}
						<span class="text-amber-700"
							>— 圧縮しましたが、ファイルサイズが小さくなりませんでした</span
						>
					{/if}
				</p>
				<a
					href={compressResultUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-600 underline"
				>
					プレビューを開く
				</a>
				<button
					type="button"
					onclick={async () => {
						if (!compressResultUrl) return;
						const blob = await fetch(compressResultUrl).then((r) => r.blob());
						downloadBlob(
							blob,
							compressFile ? compressFile.name.replace('.pdf', '_compressed.pdf') : 'compressed.pdf'
						);
					}}
					class="ml-4 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
				>
					ダウンロード
				</button>
			</div>
		{/if}
	</div>

	<div class="mt-8 rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使い方</h2>
		<p class="text-sm text-gray-700">
			<strong>未使用オブジェクトの削除のみ</strong>：軽量化。テキスト・ベクター・画像を維持。<br />
			<strong>未使用オブジェクトの削除と埋め込み画像の圧縮</strong
			>：PDF内のJPEG/PNG画像をJPEGに変換して品質を下げて圧縮。テキスト・ベクターは維持。
		</p>
	</div>
</div>
