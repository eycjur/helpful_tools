<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { calculateAspectRatioConstrainedSize } from './video-size';

	const tool = tools.find((t) => t.name === 'video-compressor');

	// 動画処理用の変数
	let originalFile: File | null = null;
	let originalVideoUrl: string | null = null;
	let compressedVideoUrl: string | null = null;
	let compressedFileName = '';
	let compression: AbortController | null = null;
	let audioCapture: { context: AudioContext; source: MediaElementAudioSourceNode } | null = null;
	let videoError = '';
	let originalVideoEl: HTMLVideoElement;
	let hiddenCanvas: HTMLCanvasElement;
	let isCompressing = false;
	let compressionProgress = 0;
	let dragOver = false;

	// 圧縮設定（デフォルトはMP4、4K対応）
	let compressionSettings = {
		videoBitsPerSecond: 1000000, // 1Mbps
		audioBitsPerSecond: 128000, // 128kbps
		mimeType: 'video/mp4;codecs=h264', // MP4をデフォルトに
		quality: 0.8,
		maxWidth: 3840,
		maxHeight: 2160
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

	onDestroy(clearAll);

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

		// ファイルサイズ制限（2GB）
		const FILE_SIZE_MAX_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2GB
		const FILE_SIZE_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB

		if (file.size > FILE_SIZE_MAX_THRESHOLD) {
			alert(
				`ファイルサイズが大きすぎます（${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB）。${FILE_SIZE_MAX_THRESHOLD / 1024 / 1024 / 1024}GB以下のファイルを選択してください。`
			);
			return;
		}

		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = (file.size / 1024 / 1024).toFixed(0);
			if (
				!confirm(
					`ファイルサイズが大きいため（${sizeMB}MB）、圧縮に時間がかかる場合があります。続行しますか？`
				)
			) {
				return;
			}
		}

		// 前回のファイルを削除
		clearAll();

		originalFile = file;
		originalVideoUrl = URL.createObjectURL(file);
	}

	function updateOriginalStats() {
		if (!originalVideoEl || !originalFile) return;

		originalStats = {
			size: originalFile.size,
			duration: originalVideoEl.duration,
			width: originalVideoEl.videoWidth,
			height: originalVideoEl.videoHeight,
			bitrate:
				originalVideoEl.duration > 0
					? Math.round((originalFile.size * 8) / originalVideoEl.duration)
					: 0
		};

		// 圧縮設定の自動調整（アスペクト比を維持、4K対応）
		const { width: autoMaxWidth, height: autoMaxHeight } = calculateAspectRatioConstrainedSize(
			originalStats.width,
			originalStats.height,
			3840,
			2160
		);
		compressionSettings.maxWidth = autoMaxWidth;
		compressionSettings.maxHeight = autoMaxHeight;
	}

	// 動画圧縮処理
	async function compressVideo() {
		const file = originalFile;
		const video = originalVideoEl;
		const { width, height } = originalStats;
		if (!file || !video || !width || !height || isCompressing) return;

		const { maxWidth, maxHeight, mimeType, videoBitsPerSecond, audioBitsPerSecond } =
			compressionSettings;
		if (
			!Number.isInteger(maxWidth) ||
			maxWidth < 1 ||
			maxWidth > 7680 ||
			!Number.isInteger(maxHeight) ||
			maxHeight < 1 ||
			maxHeight > 4320
		) {
			alert('最大幅は1〜7680、最大高さは1〜4320の整数を入力してください');
			return;
		}

		const controller = new AbortController();
		compression = controller;
		isCompressing = true;
		compressionProgress = 0;
		if (compressedVideoUrl) URL.revokeObjectURL(compressedVideoUrl);
		compressedVideoUrl = null;

		let videoStream: MediaStream | undefined;
		let audioDestination: MediaStreamAudioDestinationNode | undefined;
		let audioSource: MediaElementAudioSourceNode | undefined;
		let recorder: MediaRecorder | undefined;
		let frame = 0;
		try {
			const { width: targetWidth, height: targetHeight } = calculateAspectRatioConstrainedSize(
				width,
				height,
				maxWidth,
				maxHeight
			);
			const canvas = hiddenCanvas;
			canvas.width = targetWidth;
			canvas.height = targetHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvasの初期化に失敗しました');
			videoStream = canvas.captureStream(30);

			try {
				// 同じvideo要素には1つのAudioSourceNodeだけを作り、各録画で使い回す。
				if (!audioCapture) {
					const context = new AudioContext();
					try {
						const source = context.createMediaElementSource(video);
						source.connect(context.destination);
						audioCapture = { context, source };
					} catch (error) {
						void context.close().catch(console.error);
						throw error;
					}
				}
				audioSource = audioCapture.source;
				audioDestination = audioCapture.context.createMediaStreamDestination();
				audioSource.connect(audioDestination);
				const [track] = audioDestination.stream.getAudioTracks();
				if (track) videoStream.addTrack(track);
			} catch (error) {
				console.warn('音声トラックの取得に失敗しました。映像のみで圧縮を続行します:', error);
			}

			const activeRecorder = new MediaRecorder(videoStream, {
				mimeType,
				videoBitsPerSecond,
				audioBitsPerSecond
			});
			recorder = activeRecorder;
			const chunks: Blob[] = [];
			const recording = new Promise<Blob>((resolve, reject) => {
				activeRecorder.ondataavailable = ({ data }) => {
					if (data.size > 0) chunks.push(data);
				};
				activeRecorder.onstop = () =>
					resolve(new Blob(chunks, { type: chunks[0]?.type || activeRecorder.mimeType }));
				activeRecorder.onerror = () => reject(new Error('録画に失敗しました'));
				controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
					once: true
				});

				const drawFrame = () => {
					if (video.ended) {
						if (activeRecorder.state !== 'inactive') activeRecorder.stop();
						return;
					}
					if (video.paused) {
						reject(new Error('元動画の再生が停止しました'));
						return;
					}
					ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
					if (Number.isFinite(video.duration) && video.duration > 0) {
						compressionProgress = Math.min(
							99,
							Math.round((video.currentTime / video.duration) * 100)
						);
					}
					frame = requestAnimationFrame(drawFrame);
				};

				activeRecorder.start();
				video.currentTime = 0;
				video
					.play()
					.then(() => {
						if (!controller.signal.aborted) drawFrame();
					})
					.catch(reject);
			});

			const blob = await recording;
			if (controller.signal.aborted) return;
			if (!blob.size) throw new Error('録画データを取得できませんでした');
			const type = blob.type.split(';')[0];
			const extension = type === 'video/mpeg' ? 'mpeg' : type === 'video/mp4' ? 'mp4' : 'webm';
			const baseName = file.name.replace(/\.[^.]+$/, '');
			compressedFileName = `${baseName}_compressed.${extension}`;
			compressedVideoUrl = URL.createObjectURL(blob);
			const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime;
			compressedStats = {
				size: blob.size,
				duration,
				width: targetWidth,
				height: targetHeight,
				bitrate: duration > 0 ? Math.round((blob.size * 8) / duration) : 0
			};
			compressionProgress = 100;
		} catch (error) {
			if (!controller.signal.aborted) {
				alert('圧縮に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
			}
		} finally {
			cancelAnimationFrame(frame);
			if (recorder && recorder.state !== 'inactive') recorder.stop();
			video.pause();
			videoStream?.getTracks().forEach((track) => track.stop());
			if (audioDestination) {
				if (audioSource && audioCapture?.source === audioSource)
					audioSource.disconnect(audioDestination);
				audioDestination.stream.getTracks().forEach((track) => track.stop());
			}
			if (compression === controller) {
				compression = null;
				isCompressing = false;
			}
		}
	}

	function downloadCompressed() {
		if (!compressedVideoUrl) return;

		const a = document.createElement('a');
		a.href = compressedVideoUrl;
		a.download = compressedFileName;
		a.click();
	}

	function clearAll() {
		compression?.abort();
		compression = null;
		if (audioCapture) {
			void audioCapture.context.close().catch(console.error);
			audioCapture = null;
		}
		revokeObjectUrls();
		videoError = '';
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
		if (!Number.isFinite(seconds)) return '—';
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
		if (
			!Number.isFinite(originalStats.duration) ||
			originalStats.duration <= 0 ||
			!originalStats.width ||
			!originalStats.height
		)
			return 0;

		// 解像度変更による影響を計算（アスペクト比を維持）
		const { width: targetWidth, height: targetHeight } = calculateAspectRatioConstrainedSize(
			originalStats.width,
			originalStats.height,
			compressionSettings.maxWidth,
			compressionSettings.maxHeight
		);

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
						min="1"
						max="7680"
						step="1"
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
						min="1"
						max="4320"
						step="1"
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
	{#if Number.isFinite(originalStats.duration) && originalStats.duration > 0}
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
					disabled={isCompressing ||
						!availableMimeTypes.length ||
						!originalStats.width ||
						!!videoError}
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
					{#key originalVideoUrl}
						<!-- svelte-ignore a11y-media-has-caption -->
						<video
							bind:this={originalVideoEl}
							src={originalVideoUrl}
							controls={!isCompressing}
							on:loadedmetadata={onVideoLoaded}
							on:error={() => (videoError = '動画を読み込めませんでした')}
							class="w-full rounded bg-gray-100"
						></video>
					{/key}
					{#if videoError}
						<p role="alert" class="mt-2 text-sm text-red-600">{videoError}</p>
					{/if}

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
