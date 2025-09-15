<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	const tool = tools.find((t) => t.name === 'video-compressor');

	// 動画処理用の変数
	let originalFile: File | null = null;
	let originalVideoUrl: string | null = null;
	let compressedVideoUrl: string | null = null;
	let originalVideoEl: HTMLVideoElement;
	let hiddenCanvas: HTMLCanvasElement;
	let isCompressing = false;
	let compressionProgress = 0;
	let dragOver = false;

	// 圧縮設定（デフォルトはMP4）
	let compressionSettings = {
		videoBitsPerSecond: 1000000, // 1Mbps
		audioBitsPerSecond: 128000, // 128kbps
		mimeType: 'video/mp4;codecs=h264', // MP4をデフォルトに
		quality: 0.8,
		maxWidth: 1920,
		maxHeight: 1080
	};

	// 動画情報
	let originalStats = {
		size: 0,
		duration: 0,
		width: 0,
		height: 0,
		bitrate: 0
	};

	let compressedStats = {
		size: 0,
		duration: 0,
		width: 0,
		height: 0,
		bitrate: 0
	};

	// サポートされているMIMEタイプ
	const supportedMimeTypes = [
		'video/webm;codecs=vp9',
		'video/webm;codecs=vp8',
		'video/webm',
		'video/mp4;codecs=h264',
		'video/mp4;codecs=avc1.42E01E',
		'video/mp4;codecs=avc1.64001E',
		'video/mp4',
		'video/mpeg'
	];

	let availableMimeTypes: string[] = [];

	// ブラウザでのみ実行される初期化処理
	onMount(() => {
		if (browser && typeof MediaRecorder !== 'undefined') {
			availableMimeTypes = supportedMimeTypes.filter((type) => MediaRecorder.isTypeSupported(type));

			// デフォルトのMIMEタイプを利用可能な形式から自動選択
			if (availableMimeTypes.length > 0) {
				// MP4系を優先して探す
				const preferredMp4 = availableMimeTypes.find(
					(type) => type.includes('mp4') && type.includes('h264')
				);
				const fallbackMp4 = availableMimeTypes.find((type) => type.includes('mp4'));
				const webmVp9 = availableMimeTypes.find((type) => type.includes('vp9'));

				compressionSettings.mimeType =
					preferredMp4 || fallbackMp4 || webmVp9 || availableMimeTypes[0];
			}
		}
	});

	function revokeObjectUrls() {
		if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
		if (compressedVideoUrl) URL.revokeObjectURL(compressedVideoUrl);
	}

	onDestroy(revokeObjectUrls);

	// ファイル処理
	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length) {
			processFile(input.files[0]);
			input.value = '';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) {
			processFile(e.dataTransfer.files[0]);
		}
	}

	function processFile(file: File) {
		if (!file.type.startsWith('video/')) {
			alert('動画ファイルを選択してください');
			return;
		}

		// 前回のファイルを削除
		clearAll();

		originalFile = file;
		originalVideoUrl = URL.createObjectURL(file);

		// 動画情報を取得
		setTimeout(() => {
			if (originalVideoEl && originalVideoEl.readyState >= 1) {
				updateOriginalStats();
			}
		}, 100);
	}

	function updateOriginalStats() {
		if (!originalVideoEl || !originalFile) return;

		originalStats = {
			size: originalFile.size,
			duration: originalVideoEl.duration,
			width: originalVideoEl.videoWidth,
			height: originalVideoEl.videoHeight,
			bitrate: Math.round((originalFile.size * 8) / originalVideoEl.duration)
		};

		// 圧縮設定の自動調整
		compressionSettings.maxWidth = Math.min(originalStats.width, 1920);
		compressionSettings.maxHeight = Math.min(originalStats.height, 1080);
	}

	// 動画圧縮処理
	async function compressVideo() {
		if (!originalFile || !originalVideoEl) return;

		isCompressing = true;
		compressionProgress = 0;

		try {
			// キャンバスの設定
			const canvas = hiddenCanvas;
			const targetWidth = Math.min(originalStats.width, compressionSettings.maxWidth);
			const targetHeight = Math.min(originalStats.height, compressionSettings.maxHeight);

			canvas.width = targetWidth;
			canvas.height = targetHeight;

			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas context not available');

			// MediaStream取得
			const stream = canvas.captureStream(30); // 30fps

			// 元動画の音声ストリームを取得（可能であれば）
			try {
				const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const audioTrack = audioStream.getAudioTracks()[0];
				if (audioTrack) {
					stream.addTrack(audioTrack);
				}
			} catch {
				// 音声取得できない場合は続行
			}

			// MediaRecorder設定
			const recordOptions = {
				mimeType: compressionSettings.mimeType,
				videoBitsPerSecond: compressionSettings.videoBitsPerSecond,
				audioBitsPerSecond: compressionSettings.audioBitsPerSecond
			};

			const recorder = new MediaRecorder(stream, recordOptions);
			const chunks: Blob[] = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunks.push(event.data);
				}
			};

			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: compressionSettings.mimeType });
				if (compressedVideoUrl) URL.revokeObjectURL(compressedVideoUrl);
				compressedVideoUrl = URL.createObjectURL(blob);

				// 圧縮後の統計情報
				compressedStats = {
					size: blob.size,
					duration: originalStats.duration,
					width: targetWidth,
					height: targetHeight,
					bitrate: Math.round((blob.size * 8) / originalStats.duration)
				};

				isCompressing = false;
				compressionProgress = 100;
			};

			// 録画開始
			recorder.start();

			// 元動画を再生してキャンバスに描画
			originalVideoEl.currentTime = 0;
			await originalVideoEl.play();

			const drawFrame = () => {
				if (isCompressing && !originalVideoEl.paused && !originalVideoEl.ended) {
					ctx.drawImage(originalVideoEl, 0, 0, targetWidth, targetHeight);

					// 進捗更新
					compressionProgress = Math.round(
						(originalVideoEl.currentTime / originalVideoEl.duration) * 100
					);

					requestAnimationFrame(drawFrame);
				} else {
					// 録画終了
					recorder.stop();
					originalVideoEl.pause();

					// 音声ストリームのクリーンアップ
					stream.getTracks().forEach((track) => track.stop());
				}
			};

			drawFrame();
		} catch (error) {
			console.error('Compression failed:', error);
			alert('圧縮に失敗しました: ' + (error as Error).message);
			isCompressing = false;
		}
	}

	function downloadCompressed() {
		if (!compressedVideoUrl) return;

		const a = document.createElement('a');
		a.href = compressedVideoUrl;
		a.download = getCompressedFileName();
		a.click();
	}

	function getCompressedFileName(): string {
		if (!originalFile) return 'compressed.webm';

		const baseName = originalFile.name.replace(/\.[^.]+$/, '');
		let extension = 'webm';

		if (
			compressionSettings.mimeType.includes('mp4') ||
			compressionSettings.mimeType.includes('mpeg')
		) {
			extension = 'mp4';
		} else if (compressionSettings.mimeType.includes('webm')) {
			extension = 'webm';
		}

		return `${baseName}_compressed.${extension}`;
	}

	function clearAll() {
		revokeObjectUrls();
		originalFile = null;
		originalVideoUrl = null;
		compressedVideoUrl = null;
		isCompressing = false;
		compressionProgress = 0;

		originalStats = { size: 0, duration: 0, width: 0, height: 0, bitrate: 0 };
		compressedStats = { size: 0, duration: 0, width: 0, height: 0, bitrate: 0 };
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0 || isNaN(bytes)) return '0 B';
		const absBytes = Math.abs(bytes);
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(absBytes) / Math.log(k));
		return parseFloat((absBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatBitrate(bps: number): string {
		const kbps = Math.round(bps / 1000);
		if (kbps > 1000) {
			return (kbps / 1000).toFixed(1) + ' Mbps';
		}
		return kbps + ' kbps';
	}

	function formatDuration(seconds: number): string {
		if (isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// 動画がロードされたときの処理
	function onVideoLoaded() {
		updateOriginalStats();
	}

	// 想定される圧縮後のファイルサイズを計算（解像度変更を考慮）
	function calculateEstimatedSize(): number {
		if (!originalStats.duration || !originalStats.width || !originalStats.height) return 0;

		// 解像度変更による影響を計算
		const targetWidth = Math.min(originalStats.width, compressionSettings.maxWidth);
		const targetHeight = Math.min(originalStats.height, compressionSettings.maxHeight);

		const originalPixels = originalStats.width * originalStats.height;
		const targetPixels = targetWidth * targetHeight;
		const resolutionRatio = targetPixels / originalPixels;

		// 解像度が下がる場合は、同じビットレートでより効率的に圧縮できると仮定
		const adjustedVideoBitrate =
			compressionSettings.videoBitsPerSecond * Math.sqrt(resolutionRatio);
		const totalBitrate = adjustedVideoBitrate + compressionSettings.audioBitsPerSecond;

		return Math.round((totalBitrate * originalStats.duration) / 8);
	}

	// 想定サイズと現在のサイズとの削減率を計算
	function calculateEstimatedReduction(): number {
		if (!originalStats.size) return 0;
		const estimatedSize = calculateEstimatedSize();
		return ((originalStats.size - estimatedSize) / originalStats.size) * 100;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 圧縮設定 -->
	<div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-medium text-gray-900">画質設定</h3>
			<div class="space-y-3">
				<div>
					<label for="video-bitrate-range" class="block text-sm font-medium text-gray-700">
						動画ビットレート: {formatBitrate(compressionSettings.videoBitsPerSecond)}
					</label>
					<input
						id="video-bitrate-range"
						type="range"
						min="100000"
						max="10000000"
						step="100000"
						bind:value={compressionSettings.videoBitsPerSecond}
						class="mt-1 w-full"
					/>
				</div>
				<div>
					<label for="audio-bitrate-range" class="block text-sm font-medium text-gray-700">
						音声ビットレート: {Math.round(compressionSettings.audioBitsPerSecond / 1000)} kbps
					</label>
					<input
						id="audio-bitrate-range"
						type="range"
						min="64000"
						max="320000"
						step="32000"
						bind:value={compressionSettings.audioBitsPerSecond}
						class="mt-1 w-full"
					/>
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-medium text-gray-900">解像度設定</h3>
			<div class="space-y-3">
				<div>
					<label for="max-width-input" class="block text-sm font-medium text-gray-700"
						>最大幅 (px)</label
					>
					<input
						id="max-width-input"
						type="number"
						bind:value={compressionSettings.maxWidth}
						min="320"
						max="3840"
						step="8"
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
					/>
				</div>
				<div>
					<label for="max-height-input" class="block text-sm font-medium text-gray-700"
						>最大高さ (px)</label
					>
					<input
						id="max-height-input"
						type="number"
						bind:value={compressionSettings.maxHeight}
						min="240"
						max="2160"
						step="8"
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
					/>
				</div>
			</div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-medium text-gray-900">フォーマット設定</h3>
			<div class="space-y-3">
				<div>
					<label for="output-format-select" class="block text-sm font-medium text-gray-700"
						>出力形式</label
					>
					<select
						id="output-format-select"
						bind:value={compressionSettings.mimeType}
						class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
					>
						{#each availableMimeTypes as mimeType (mimeType)}
							<option value={mimeType}>
								{mimeType.includes('vp9')
									? 'WebM (VP9 - 最高品質)'
									: mimeType.includes('vp8')
										? 'WebM (VP8 - 高品質)'
										: mimeType.includes('h264')
											? 'MP4 (H.264)'
											: mimeType.includes('avc1.42E01E')
												? 'MP4 (H.264 Baseline)'
												: mimeType.includes('avc1.64001E')
													? 'MP4 (H.264 High)'
													: mimeType.includes('mp4')
														? 'MP4 (汎用)'
														: mimeType.includes('mpeg')
															? 'MPEG'
															: 'WebM (標準)'}
							</option>
						{/each}
					</select>
				</div>
				{#if !availableMimeTypes.length}
					<p class="text-sm text-red-600">お使いのブラウザは動画圧縮をサポートしていません</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- ファイル選択エリア -->
	<div
		role="button"
		tabindex="0"
		on:dragover|preventDefault={() => (dragOver = true)}
		on:dragleave={() => (dragOver = false)}
		on:drop={handleDrop}
		on:click={() => document.getElementById('video-file-input')?.click()}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('video-file-input')?.click();
			}
		}}
		class="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50 {dragOver
			? 'scale-105 border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon
			icon="mdi:video-plus"
			class="mb-4 h-16 w-16 transition-colors {dragOver ? 'text-blue-500' : 'text-gray-400'}"
		/>
		<h3 class="mb-2 text-lg font-medium text-gray-700">
			{dragOver ? '動画ファイルをここに放してください' : '動画ファイルを選択'}
		</h3>
		<p class="mb-4 text-sm text-gray-600">
			ファイルをドラッグ&ドロップするか、クリックしてファイルを選択
		</p>
		<div class="flex flex-col items-center gap-3">
			<button
				type="button"
				class="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			>
				<Icon icon="mdi:folder-open" class="mr-2 inline h-5 w-5" />
				ファイルを選択
			</button>
			<p class="text-xs text-gray-500">対応形式: MP4, WebM, AVI, MOV, MKV, FLV</p>
		</div>
		<input
			id="video-file-input"
			type="file"
			accept="video/*"
			on:change={handleFileSelect}
			class="hidden"
		/>
	</div>

	<!-- 想定容量表示 -->
	{#if originalStats.duration > 0}
		{@const estimatedSize = calculateEstimatedSize()}
		{@const estimatedReduction = calculateEstimatedReduction()}
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<Icon icon="mdi:calculator" class="mr-2 h-5 w-5 text-blue-600" />
					<span class="font-medium text-blue-900">想定圧縮結果</span>
				</div>
				<div class="text-right">
					<div class="text-lg font-semibold text-blue-900">
						{formatFileSize(estimatedSize)}
					</div>
					<div class="text-sm text-blue-700">
						{estimatedReduction > 0 ? '-' : '+'}{Math.abs(estimatedReduction).toFixed(1)}% ({estimatedReduction >
						0
							? '削減'
							: '増加'}予想)
					</div>
				</div>
			</div>
			<div class="mt-2 text-xs text-blue-600">
				※実際の結果は動画の内容により変わる場合があります
			</div>
		</div>
	{/if}

	<!-- 動画プレビューとアクション -->
	{#if originalVideoUrl}
		<div class="mb-6 space-y-6">
			<!-- アクション -->
			<div class="flex items-center justify-center gap-4">
				<button
					on:click={compressVideo}
					disabled={isCompressing || !availableMimeTypes.length}
					class="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isCompressing}
						<div class="flex items-center">
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							圧縮中... {compressionProgress}%
						</div>
					{:else}
						<Icon icon="mdi:compress" class="mr-2 inline h-5 w-5" />
						動画を圧縮
					{/if}
				</button>
				<button
					on:click={clearAll}
					class="rounded bg-gray-500 px-6 py-3 text-white hover:bg-gray-600"
				>
					クリア
				</button>
			</div>

			<!-- プレビューエリア -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- 元動画 -->
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h3 class="mb-3 font-medium text-gray-900">元動画</h3>
					<!-- svelte-ignore a11y-media-has-caption -->
					<video
						bind:this={originalVideoEl}
						src={originalVideoUrl}
						controls
						on:loadedmetadata={onVideoLoaded}
						class="w-full rounded bg-gray-100"
					></video>

					{#if originalStats.size > 0}
						<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="text-gray-500">ファイルサイズ:</span>
								{formatFileSize(originalStats.size)}
							</div>
							<div>
								<span class="text-gray-500">長さ:</span>
								{formatDuration(originalStats.duration)}
							</div>
							<div>
								<span class="text-gray-500">解像度:</span>
								{originalStats.width}×{originalStats.height}
							</div>
							<div>
								<span class="text-gray-500">ビットレート:</span>
								{formatBitrate(originalStats.bitrate)}
							</div>
						</div>
					{/if}
				</div>

				<!-- 圧縮後動画 -->
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="font-medium text-gray-900">圧縮後動画</h3>
						{#if compressedVideoUrl}
							<button
								on:click={downloadCompressed}
								class="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
							>
								<Icon icon="mdi:download" class="mr-1 inline h-4 w-4" />
								ダウンロード
							</button>
						{/if}
					</div>

					{#if compressedVideoUrl}
						<!-- svelte-ignore a11y-media-has-caption -->
						<video src={compressedVideoUrl} controls class="w-full rounded bg-gray-100"></video>

						<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="text-gray-500">ファイルサイズ:</span>
								{formatFileSize(compressedStats.size)}
							</div>
							<div>
								<span class="text-gray-500">長さ:</span>
								{formatDuration(compressedStats.duration)}
							</div>
							<div>
								<span class="text-gray-500">解像度:</span>
								{compressedStats.width}×{compressedStats.height}
							</div>
							<div>
								<span class="text-gray-500">ビットレート:</span>
								{formatBitrate(compressedStats.bitrate)}
							</div>
						</div>

						<!-- 圧縮率表示 -->
						{#if originalStats.size > 0 && compressedStats.size > 0}
							{@const sizeDiff = originalStats.size - compressedStats.size}
							{@const compressionRatio = (sizeDiff / originalStats.size) * 100}
							{@const isReduced = sizeDiff > 0}
							<div class="mt-3 rounded p-2 text-center {isReduced ? 'bg-green-50' : 'bg-red-50'}">
								<span class="font-medium {isReduced ? 'text-green-700' : 'text-red-700'}">
									{isReduced ? '-' : '+'}{formatFileSize(Math.abs(sizeDiff))}
									({isReduced ? '削減' : '増加'}: {Math.abs(compressionRatio).toFixed(1)}%)
								</span>
							</div>
						{/if}
					{:else if isCompressing}
						<div class="flex h-48 items-center justify-center rounded bg-gray-100">
							<div class="text-center">
								<div
									class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
								></div>
								<p class="text-gray-600">圧縮中... {compressionProgress}%</p>
								<div class="mx-auto mt-2 h-2 w-32 rounded-full bg-gray-200">
									<div
										class="h-2 rounded-full bg-blue-600 transition-all duration-300"
										style="width: {compressionProgress}%"
									></div>
								</div>
							</div>
						</div>
					{:else}
						<div class="flex h-48 items-center justify-center rounded bg-gray-100 text-gray-500">
							圧縮を実行すると、結果がここに表示されます
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- 隠しCanvas（描画処理用） -->
	<canvas bind:this={hiddenCanvas} class="hidden"></canvas>
</div>
