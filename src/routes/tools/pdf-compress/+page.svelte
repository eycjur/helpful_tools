<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import type { SpaceReport } from './pdf-optimizer';
	import type { CompressProgress, CompressResult, CompressStage } from './compress';
	import { customFrom, resolveSettings, type LevelKey } from './levels';
	import { formatSize } from './format';
	import { analyzeInWorker, CancelledError, compressInWorker, type Job } from './worker-client';
	import CompressOptions from './CompressOptions.svelte';
	import SpaceBreakdown from './SpaceBreakdown.svelte';

	const tool = tools.find((t) => t.name === 'pdf-compress');

	let file = $state<File | null>(null);
	let fileBytes: Uint8Array | null = null;
	let report = $state<SpaceReport | null>(null);
	let dragOver = $state(false);
	let isAnalyzing = $state(false);
	let isCompressing = $state(false);
	let progress = $state<CompressProgress | null>(null);
	let errorMessage = $state('');
	let result = $state<CompressResult | null>(null);
	let resultReport = $state<SpaceReport | null>(null);
	let resultUrl = $state<string | null>(null);

	/** 実行中のWorkerジョブ（クリア・キャンセル時に止める） */
	let currentJob: Job<unknown> | null = null;
	const busy = $derived(isAnalyzing || isCompressing);

	let level = $state<LevelKey | 'custom'>('medium');
	let custom = $state(customFrom('medium'));

	const STAGES: CompressStage[] = [
		'load',
		'optimize',
		'fonts',
		'images',
		'streams',
		'save',
		'analyze'
	];
	const STAGE_LABELS: Record<CompressStage, string> = {
		load: 'PDFを読み込み中',
		optimize: '重複・不要データを整理中',
		fonts: 'フォントを使用文字だけに削減中',
		images: '画像を再圧縮中',
		streams: 'データを再圧縮中',
		save: '保存中',
		analyze: '圧縮後の内訳を解析中'
	};

	function resetResult() {
		if (resultUrl) URL.revokeObjectURL(resultUrl);
		resultUrl = null;
		result = null;
		resultReport = null;
	}

	function errorText(prefix: string, err: unknown) {
		return prefix + (err instanceof Error ? err.message : String(err));
	}

	async function selectFile(f: File | undefined) {
		if (busy || f?.type !== 'application/pdf') return;
		resetResult();
		file = f;
		report = null;
		fileBytes = null;
		errorMessage = '';
		isAnalyzing = true;
		try {
			const bytes = new Uint8Array(await f.arrayBuffer());
			if (file !== f) return; // 読み込み中にキャンセルされた
			const job = analyzeInWorker(bytes);
			currentJob = job;
			report = await job.promise;
			fileBytes = bytes;
		} catch (err) {
			if (!(err instanceof CancelledError))
				errorMessage = errorText('PDFを読み込めませんでした: ', err);
		} finally {
			isAnalyzing = false;
			currentJob = null;
		}
	}

	async function doCompress() {
		if (!fileBytes || busy) return;
		isCompressing = true;
		progress = null;
		errorMessage = '';
		resetResult();
		try {
			// $state のProxyはWorkerへ送れないため、プレーンなオブジェクトにする
			const settings = $state.snapshot(resolveSettings(level, custom));
			const job = compressInWorker(fileBytes, settings, (p) => (progress = p));
			currentJob = job;
			const done = await job.promise;
			resultReport = done.report ?? report;
			result = done.result;
			resultUrl = URL.createObjectURL(
				new Blob([new Uint8Array(done.result.bytes)], { type: 'application/pdf' })
			);
		} catch (err) {
			if (!(err instanceof CancelledError)) errorMessage = errorText('圧縮に失敗しました: ', err);
		} finally {
			isCompressing = false;
			progress = null;
			currentJob = null;
		}
	}

	function cancel() {
		currentJob?.cancel();
		// 解析を止めた場合は内訳がなく圧縮できないため、ファイル選択前に戻す
		if (isAnalyzing) file = null;
	}

	// ページを離れたら処理中のWorkerを止め、結果のBlob URLを解放する
	onDestroy(() => {
		currentJob?.cancel();
		if (resultUrl) URL.revokeObjectURL(resultUrl);
	});

	function download() {
		if (!resultUrl || !file) return;
		const a = document.createElement('a');
		a.href = resultUrl;
		a.download = file.name.replace(/\.pdf$/i, '') + '_compressed.pdf';
		a.click();
	}

	function clearAll() {
		cancel();
		resetResult();
		file = null;
		fileBytes = null;
		report = null;
		errorMessage = '';
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
				if (busy) return;
				selectFile(e.dataTransfer?.files?.[0]);
			}}
		>
			<input
				type="file"
				accept="application/pdf"
				class="hidden"
				id="compress-input"
				disabled={busy}
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
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<p class="font-medium">{file.name}</p>
				<p class="mb-4 text-sm text-gray-600">
					{formatSize(file.size)}{#if report}・{report.pageCount}ページ{/if}
					{#if isAnalyzing}・解析中...{/if}
				</p>

				{#if report?.hasSignature}
					<p class="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
						このPDFには電子署名が含まれています。圧縮するとファイル全体を書き直すため署名は無効になります。署名済みの原本は別に保管してください。
					</p>
				{/if}

				<CompressOptions bind:level bind:custom />

				<div class="mt-4 flex gap-2">
					<button
						type="button"
						onclick={doCompress}
						disabled={busy || !report}
						class="rounded bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{isCompressing ? '圧縮中...' : '圧縮する'}
					</button>
					{#if busy}
						<button
							type="button"
							onclick={cancel}
							class="rounded border border-gray-400 bg-white px-4 py-2 text-gray-700 hover:bg-gray-100"
						>
							キャンセル
						</button>
					{:else}
						<button
							type="button"
							onclick={clearAll}
							class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
						>
							クリア
						</button>
					{/if}
				</div>

				{#if isCompressing}
					{@const step = progress ? STAGES.indexOf(progress.stage) + 1 : 0}
					<div class="mt-4" role="status" aria-live="polite">
						<p class="mb-1 text-sm text-gray-700">
							{#if progress}
								{step}/{STAGES.length}
								{STAGE_LABELS[progress.stage]}
								{#if progress.total}（{progress.done} / {progress.total}）{/if}
							{:else}
								準備中...
							{/if}
						</p>
						<div class="h-2 overflow-hidden rounded bg-gray-200">
							{#if progress?.total}
								<div
									class="h-2 rounded bg-blue-500 transition-[width]"
									style="width: {((progress.done ?? 0) / progress.total) * 100}%"
								></div>
							{:else}
								<div class="h-2 w-1/3 animate-pulse rounded bg-blue-300"></div>
							{/if}
						</div>
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
				<div class="flex flex-wrap items-center gap-4">
					<button
						type="button"
						onclick={download}
						class="flex items-center gap-2 rounded bg-green-600 px-6 py-3 text-lg font-medium text-white hover:bg-green-700"
					>
						<Icon icon="mdi:download" class="h-6 w-6" />ダウンロード
					</button>
					<div>
						{#if result.keptOriginal}
							<p class="font-medium text-amber-800">
								元のファイルの方が小さいため、そのまま返します
							</p>
							<p class="text-sm">圧縮レベルを上げると小さくなる場合があります。</p>
						{:else}
							<p class="text-lg font-medium text-green-800">
								{formatSize(file.size)} → {formatSize(result.bytes.length)}
								（{((1 - result.bytes.length / file.size) * 100).toFixed(1)}%削減）
							</p>
							<p class="text-xs text-gray-600">
								画像の再圧縮 {result.stats.images}件・フォントの削減 {result.stats
									.fonts}件・重複の統合
								{result.stats.deduped}件・不要データの削除
								{result.stats.removed}件・データの再圧縮 {result.stats.recompressed}件
							</p>
						{/if}
						<a
							href={resultUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm text-blue-600 underline"
						>
							プレビューを開く
						</a>
					</div>
				</div>
			</div>
		{/if}

		{#if report}
			<SpaceBreakdown before={report} after={resultReport} />
		{/if}
	</div>

	<div class="mt-8 space-y-2 rounded-lg bg-blue-50 p-4 text-sm text-gray-700">
		<h2 class="text-lg font-semibold">使い方</h2>
		<p>
			圧縮レベルを選んで「圧縮する」を押します。どのレベルでも、重複した画像・フォント等の統合、参照されないデータの削除、描画命令・フォント・図などのデータの再圧縮を行います（画質は変わりません）。容量の内訳を見て、何が容量を占めているかに合わせて選ぶと効果的です。
		</p>
		<ul class="list-disc space-y-1 pl-5">
			<li>
				<strong>画像が大半</strong>:
				写真入りスライドなどは「中」から試し、足りなければ「強」に上げます。画質を優先するなら「弱」にします。画像は紙面に描かれた大きさでの解像度を基準に縮小します。
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
				白黒ページのJBIG2化や、文字と背景を分けるMRC圧縮はこのツールでは行いません。これらに対応した専用のソフトを使ってください。
			</li>
		</ul>
		<p class="text-xs text-gray-600">処理はすべてブラウザ内で行われ、ファイルは送信されません。</p>
	</div>
</div>
