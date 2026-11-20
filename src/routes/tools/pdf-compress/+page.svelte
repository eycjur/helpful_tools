<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { PDFDocument } from 'pdf-lib';
	import { analyzeSpace, CATEGORY_LABELS, type SpaceReport } from './pdf-optimizer';
	import { compressPdfFile, type CompressResult } from './compress';

	const tool = tools.find((t) => t.name === 'pdf-compress');

	let file = $state<File | null>(null);
	let fileBytes: Uint8Array | null = null;
	let report = $state<SpaceReport | null>(null);
	let dragOver = $state(false);
	let isAnalyzing = $state(false);
	let isCompressing = $state(false);
	let errorMessage = $state('');
	let result = $state<CompressResult | null>(null);
	let resultUrl = $state<string | null>(null);

	let removeThumbnails = $state(true);
	let removePieceInfo = $state(true);
	let removeMetadata = $state(false);
	let removeAttachments = $state(false);
	let recompressImagesEnabled = $state(false);
	let imageQuality = $state(0.85);
	let maxPpi = $state<number | null>(150);

	const MAX_IMAGE_ROWS = 10;

	function formatSize(bytes: number): string {
		if (bytes === 0 || isNaN(bytes)) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function resetResult() {
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		resultUrl = null;
		result = null;
	}

	async function selectFile(f: File | undefined) {
		if (f?.type !== 'application/pdf') return;
		resetResult();
		file = f;
		report = null;
		errorMessage = '';
		isAnalyzing = true;
		try {
			fileBytes = new Uint8Array(await f.arrayBuffer());
			const doc = await PDFDocument.load(fileBytes, { updateMetadata: false });
			report = analyzeSpace(doc, f.size);
		} catch (err) {
			errorMessage =
				'PDFを読み込めませんでした: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			isAnalyzing = false;
		}
	}

	async function doCompress() {
		if (!fileBytes) return;
		isCompressing = true;
		errorMessage = '';
		resetResult();
		try {
			const r = await compressPdfFile(fileBytes, {
				removeThumbnails,
				removePieceInfo,
				removeMetadata,
				removeAttachments,
				images: recompressImagesEnabled ? { quality: Number(imageQuality), maxPpi } : null
			});
			result = r;
			resultUrl = URL.createObjectURL(
				new Blob([new Uint8Array(r.bytes)], { type: 'application/pdf' })
			);
		} catch (err) {
			errorMessage = '圧縮に失敗しました: ' + (err instanceof Error ? err.message : String(err));
		} finally {
			isCompressing = false;
		}
	}

	function download() {
		if (!resultUrl || !file) return;
		const a = document.createElement('a');
		a.href = resultUrl;
		a.download = file.name.replace(/\.pdf$/i, '') + '_compressed.pdf';
		a.click();
	}

	function clearAll() {
		resetResult();
		file = null;
		fileBytes = null;
		report = null;
		errorMessage = '';
	}

	const categoryTotal = $derived(report?.categories.reduce((s, c) => s + c.bytes, 0) || 1);
	const unembeddedFonts = $derived(report?.fonts.filter((f) => !f.embedded).length ?? 0);
	const nonSubsetFonts = $derived(report?.fonts.filter((f) => f.embedded && !f.subset).length ?? 0);
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
			class="rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
				? 'border-blue-400 bg-blue-50'
				: 'border-gray-300'}"
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragOver = false;
				selectFile(e.dataTransfer?.files?.[0]);
			}}
		>
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				id="compress-input"
				onchange={(e) => {
					const input = e.target as HTMLInputElement;
					selectFile(input.files?.[0]);
					input.value = '';
				}}
			/>
			<label for="compress-input" class="cursor-pointer">
				<Icon icon="mdi:file-pdf-box" class="mx-auto mb-2 h-12 w-12 text-gray-400" />
				<p class="text-gray-600">PDFファイルをドラッグ＆ドロップ または クリックして選択</p>
			</label>
		</div>

		{#if errorMessage}
			<p class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
		{/if}

		{#if file}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
				<p class="font-medium">{file.name}</p>
				<p class="mb-4 text-sm text-gray-600">
					元サイズ: {formatSize(file.size)}{#if report}・{report.pageCount}ページ{/if}
				</p>

				{#if isAnalyzing}
					<p class="text-sm text-gray-600">容量の内訳を解析中...</p>
				{:else if report}
					{#if report.hasSignature}
						<p class="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
							このPDFには電子署名が含まれています。圧縮するとファイル全体を書き直すため署名は無効になります。署名済みの原本は別に保管してください。
						</p>
					{/if}

					<section class="mb-4 rounded border border-gray-200 bg-white p-3">
						<h2 class="mb-2 text-sm font-semibold">容量の内訳（目安）</h2>
						<ul class="space-y-1">
							{#each report.categories as c (c.category)}
								<li class="text-sm">
									<div class="flex justify-between">
										<span>{CATEGORY_LABELS[c.category]}</span>
										<span class="font-mono text-gray-600"
											>{formatSize(c.bytes)}（{((c.bytes / categoryTotal) * 100).toFixed(
												1
											)}%）</span
										>
									</div>
									<div class="h-1.5 rounded bg-gray-100">
										<div
											class="h-1.5 rounded bg-blue-500"
											style="width: {(c.bytes / categoryTotal) * 100}%"
										></div>
									</div>
								</li>
							{/each}
						</ul>

						{#if report.images.length > 0}
							<details class="mt-3">
								<summary class="cursor-pointer text-sm font-medium">
									画像 {report.images.length}個（容量の大きい順）
								</summary>
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
													title="ページ全面に配置した場合の解像度。実際の配置が小さければもっと高い"
													>全面配置時のppi</th
												>
											</tr>
										</thead>
										<tbody class="font-mono">
											{#each report.images.slice(0, MAX_IMAGE_ROWS) as img, i (i)}
												<tr class="border-t border-gray-100">
													<td class="py-1 pr-2">{img.width}×{img.height}</td>
													<td class="py-1 pr-2">{img.filter}</td>
													<td class="py-1 pr-2">{img.colorSpace}</td>
													<td class="py-1 pr-2">{formatSize(img.bytes)}</td>
													<td class="py-1">{img.ppiAtPageSize}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</details>
						{/if}

						{#if unembeddedFonts > 0 || nonSubsetFonts > 0}
							<p class="mt-3 text-xs text-gray-600">
								フォント: 未埋め込み {unembeddedFonts}個・サブセット化されていない埋め込み {nonSubsetFonts}個。
								{#if nonSubsetFonts > 0}フォントが大きい場合は、作成元のアプリでサブセット埋め込みにして出力し直すと効果的です。{/if}
							</p>
						{/if}
					</section>

					<div class="mb-4 space-y-3 rounded border border-gray-200 bg-white p-3">
						<p class="text-sm">
							<strong>構造の最適化</strong>（常に実行）:
							重複した画像・フォント等の統合、参照されないデータの削除、未圧縮データのFlate圧縮、オブジェクトストリーム化。画質は変わりません。
						</p>

						<fieldset class="space-y-1">
							<legend class="text-sm font-medium">付加データの削除（見た目は変わりません）</legend>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={removeThumbnails} />ページのサムネイル
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									bind:checked={removePieceInfo}
								/>作成アプリの編集用データ（PieceInfo）
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									bind:checked={removeMetadata}
								/>XMPメタデータ（作成者・作成ツール等の詳細情報）
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={removeAttachments} />添付ファイル（文書レベル）
							</label>
						</fieldset>

						<fieldset class="space-y-2">
							<label class="flex items-start gap-2 text-sm">
								<input type="checkbox" bind:checked={recompressImagesEnabled} class="mt-1" />
								<span>
									<strong>画像を再圧縮する</strong>（画質が変わります）<br />
									<span class="text-xs text-gray-600"
										>写真はJPEGで再圧縮、色数の少ないスクリーンショットや図は文字がにじまないよう可逆圧縮のまま（縮小時のみ再符号化）。透明度マスクやCMYK等の画像は対象外です。</span
									>
								</span>
							</label>
							{#if recompressImagesEnabled}
								<div class="flex flex-wrap gap-4 pl-6">
									<div>
										<label for="max-ppi" class="mb-1 block text-xs text-gray-600"
											>解像度の上限</label
										>
										<select
											id="max-ppi"
											bind:value={maxPpi}
											class="rounded border border-gray-300 px-2 py-1 text-sm"
										>
											<option value={null}>縮小しない</option>
											<option value={300}>300 ppi（印刷向け）</option>
											<option value={150}>150 ppi（画面・配布向け）</option>
											<option value={96}>96 ppi（高圧縮）</option>
										</select>
									</div>
									<div>
										<label for="image-quality" class="mb-1 block text-xs text-gray-600"
											>JPEG品質</label
										>
										<select
											id="image-quality"
											bind:value={imageQuality}
											class="rounded border border-gray-300 px-2 py-1 text-sm"
										>
											<option value={0.6}>0.6（高圧縮）</option>
											<option value={0.75}>0.75</option>
											<option value={0.85}>0.85（推奨）</option>
											<option value={0.92}>0.92（高画質）</option>
										</select>
									</div>
								</div>
								<p class="pl-6 text-xs text-gray-600">
									解像度の上限は、画像をページ全面に配置した場合の値です。小さく配置された画像はこれより高い解像度で残ります。
								</p>
							{/if}
						</fieldset>
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
							onclick={clearAll}
							class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
						>
							クリア
						</button>
					</div>
				{/if}
			</div>
		{/if}

		{#if result && resultUrl && file}
			<div
				class="rounded-lg border p-4 {result.keptOriginal
					? 'border-amber-200 bg-amber-50'
					: 'border-green-200 bg-green-50'}"
			>
				{#if result.keptOriginal}
					<p class="mb-2 font-medium text-amber-800">
						元のファイルの方が小さいため、そのまま返します
					</p>
					<p class="mb-2 text-sm">
						このPDFはすでに最適化されています。画像が容量の多くを占める場合は「画像を再圧縮する」を試してください。
					</p>
				{:else}
					<p class="mb-2 font-medium text-green-800">圧縮完了</p>
					<p class="mb-2 text-sm">
						元: {formatSize(file.size)} → 圧縮後: {formatSize(result.bytes.length)}
						（{((1 - result.bytes.length / file.size) * 100).toFixed(1)}%削減）
					</p>
					<p class="mb-2 text-xs text-gray-600">
						重複の統合 {result.stats.deduped}件・不要データの削除 {result.stats
							.removed}件・Flate圧縮
						{result.stats.deflated}件・画像の再圧縮 {result.stats.images}件
					</p>
				{/if}
				<a
					href={resultUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-600 underline"
				>
					プレビューを開く
				</a>
				<button
					type="button"
					onclick={download}
					class="ml-4 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
				>
					ダウンロード
				</button>
			</div>
		{/if}
	</div>

	<div class="mt-8 space-y-2 rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
		<h2 class="text-lg font-semibold">使い方</h2>
		<p>
			まず「容量の内訳」で何が容量を占めているかを確認し、それに合う方法を選びます。画質を保ちたい場合は構造の最適化だけで試し、まだ大きければ画像の再圧縮を使います。
		</p>
		<ul class="list-disc space-y-1 pl-5">
			<li>
				<strong>画像が大半</strong>: 写真入りスライドなどは、解像度の上限150
				ppiとJPEG品質0.85から試すと効果的です。
			</li>
			<li>
				<strong>ページの描画命令・図が大半</strong>:
				点の多い散布図やヒートマップは、作成元でその部分だけ画像化（例: Matplotlib の
				<code>rasterized=True</code>）して出力し直すと大きく減ります。
			</li>
			<li>
				<strong>フォントが大半</strong>:
				作成元のアプリでフォントをサブセット埋め込みにして出力し直してください。
			</li>
			<li>
				<strong>スキャンした本</strong>:
				白黒ページのJBIG2化や、文字と背景を分けるMRC圧縮はこのツールでは行いません。専用ソフト（Acrobat
				Pro等）を使ってください。
			</li>
		</ul>
		<p class="text-xs text-gray-600">処理はすべてブラウザ内で行われ、ファイルは送信されません。</p>
	</div>
</div>
