<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg';

	const tool = tools.find((t) => t.name === 'video-reverse');

	let ffmpeg: FFmpegType | null = $state(null);
	let isLoading = $state(false);
	let isConverting = $state(false);
	let conversionProgress = $state(0);
	let progressMessage = $state('');
	let dragOver = $state(false);
	let errorMessage = $state('');
	let warningMessage = $state('');
	let usedAudioReverse = $state(false);

	let originalFile: File | null = $state(null);
	let originalVideoUrl: string | null = $state(null);
	let reversedVideoUrl: string | null = $state(null);
	let originalVideoEl: HTMLVideoElement | undefined = $state(undefined);

	let videoInfo = $state({
		duration: 0,
		size: 0
	});

	const FILE_SIZE_WARNING_THRESHOLD = 500 * 1024 * 1024;
	const OUTPUT_FILE_NAME = 'output_reversed.mp4';

	function buildReverseArgs(inputFile: string, includeAudio: boolean): string[] {
		const args = [
			'-i',
			inputFile,
			'-vf',
			'reverse',
			'-c:v',
			'libx264',
			'-preset',
			'ultrafast',
			'-crf',
			'23'
		];
		if (includeAudio) {
			args.push('-af', 'areverse', '-c:a', 'aac', '-b:a', '192k');
		} else {
			args.push('-an');
		}
		args.push('-movflags', '+faststart', OUTPUT_FILE_NAME);
		return args;
	}

	async function loadFFmpeg() {
		if (!browser) return;

		isLoading = true;
		errorMessage = '';

		try {
			const { FFmpeg } = await import('@ffmpeg/ffmpeg');
			const { toBlobURL } = await import('@ffmpeg/util');

			const ffmpegInstance = new FFmpeg();

			ffmpegInstance.on('log', ({ message }) => {
				progressMessage = message;
				const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
				if (timeMatch && videoInfo.duration > 0) {
					const hours = parseInt(timeMatch[1], 10);
					const minutes = parseInt(timeMatch[2], 10);
					const seconds = parseInt(timeMatch[3], 10);
					const currentTime = hours * 3600 + minutes * 60 + seconds;
					conversionProgress = Math.min(Math.round((currentTime / videoInfo.duration) * 100), 99);
				}
			});

			const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
			await ffmpegInstance.load({
				coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
				wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
			});

			ffmpeg = ffmpegInstance;
			isLoading = false;
		} catch (error) {
			console.error('FFmpeg load error:', error);
			errorMessage =
				'FFmpegの読み込みに失敗しました。ブラウザを更新して再試行してください。' +
				(error instanceof Error ? ` (${error.message})` : '');
			isLoading = false;
		}
	}

	onMount(() => {
		loadFFmpeg();
	});

	onDestroy(() => {
		revokeUrls();
		if (ffmpeg) {
			try {
				ffmpeg.terminate();
			} catch {
				/* ignore */
			}
		}
	});

	function revokeUrls() {
		if (originalVideoUrl) {
			URL.revokeObjectURL(originalVideoUrl);
			originalVideoUrl = null;
		}
		if (reversedVideoUrl) {
			URL.revokeObjectURL(reversedVideoUrl);
			reversedVideoUrl = null;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
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
			errorMessage = '動画ファイルを選択してください';
			return;
		}

		clearAll();

		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = Math.round(file.size / 1024 / 1024);
			warningMessage = `ファイルサイズが大きいため（${sizeMB}MB）、逆再生変換に時間とメモリを多く使います。ブラウザが応答しなくなる場合があります。`;
		}

		originalFile = file;
		originalVideoUrl = URL.createObjectURL(file);
		videoInfo.size = file.size;
		errorMessage = '';
	}

	function onVideoLoaded() {
		if (originalVideoEl) {
			videoInfo.duration = originalVideoEl.duration;
		}
	}

	async function convertReverse() {
		if (!ffmpeg?.loaded || !originalFile) {
			errorMessage = 'FFmpegが読み込まれていないか、ファイルが選択されていません';
			return;
		}

		isConverting = true;
		conversionProgress = 0;
		progressMessage = '変換を準備しています...';
		errorMessage = '';
		usedAudioReverse = false;

		let inputFileName = '';

		try {
			const fileData = new Uint8Array(await originalFile.arrayBuffer());
			inputFileName = 'input' + getFileExtension(originalFile.name);
			await ffmpeg.writeFile(inputFileName, fileData);

			progressMessage = '映像・音声を逆順に再エンコードしています...';

			let lastError: unknown = null;
			for (const includeAudio of [true, false]) {
				try {
					await ffmpeg.deleteFile(OUTPUT_FILE_NAME).catch(() => {});
					await ffmpeg.exec(buildReverseArgs(inputFileName, includeAudio));
					usedAudioReverse = includeAudio;
					lastError = null;
					break;
				} catch (err) {
					lastError = err;
					if (includeAudio) {
						progressMessage = '音声がないか未対応のため、映像のみを逆順に変換します...';
					}
				}
			}

			if (lastError !== null) {
				throw lastError;
			}

			const outputData = await ffmpeg.readFile(OUTPUT_FILE_NAME);
			if (!(outputData instanceof Uint8Array)) {
				throw new Error('FFmpegから予期しない出力形式が返されました');
			}

			const blob = new Blob([outputData], { type: 'video/mp4' });
			if (reversedVideoUrl) URL.revokeObjectURL(reversedVideoUrl);
			reversedVideoUrl = URL.createObjectURL(blob);

			conversionProgress = 100;
			progressMessage = '完了しました';
		} catch (error) {
			console.error('Reverse conversion error:', error);
			let message = '変換に失敗しました';
			if (error instanceof Error) {
				if (error.message.includes('Invalid data') || error.message.includes('Invalid input')) {
					message = '動画ファイルが破損しているか、対応していない形式です';
				} else if (error.message.includes('memory') || error.message.includes('Memory')) {
					message = 'メモリ不足です。より短い・小さい動画をお試しください';
				} else {
					message = `変換に失敗しました: ${error.message}`;
				}
			}
			errorMessage = message;
		} finally {
			if (ffmpeg) {
				try {
					if (inputFileName) await ffmpeg.deleteFile(inputFileName);
				} catch {
					/* ignore */
				}
				try {
					await ffmpeg.deleteFile(OUTPUT_FILE_NAME);
				} catch {
					/* ignore */
				}
			}
			isConverting = false;
		}
	}

	function getFileExtension(filename: string): string {
		const match = filename.match(/\.[^.]+$/);
		return match ? match[0] : '.mp4';
	}

	function downloadReversed() {
		if (!reversedVideoUrl || !originalFile) return;

		const baseName = originalFile.name.replace(/\.[^.]+$/, '');
		const a = document.createElement('a');
		a.href = reversedVideoUrl;
		a.download = `${baseName}_reversed.mp4`;
		a.click();
	}

	function clearAll() {
		revokeUrls();
		originalFile = null;
		conversionProgress = 0;
		progressMessage = '';
		errorMessage = '';
		warningMessage = '';
		usedAudioReverse = false;
		videoInfo = { duration: 0, size: 0 };
	}

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatDuration(seconds: number): string {
		if (isNaN(seconds) || seconds === 0) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	{#if isLoading}
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
			<div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<p class="text-blue-700">FFmpegを読み込んでいます...</p>
			<p class="mt-1 text-sm text-blue-600">初回読み込みには少し時間がかかる場合があります</p>
		</div>
	{/if}

	{#if errorMessage}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<Icon icon="mdi:alert-circle" class="mr-2 h-5 w-5 text-red-600" />
				<p class="text-red-700">{errorMessage}</p>
			</div>
		</div>
	{/if}

	{#if warningMessage}
		<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
			<div class="flex items-start">
				<Icon icon="mdi:alert" class="mr-2 h-5 w-5 flex-shrink-0 text-yellow-600" />
				<p class="text-yellow-800">{warningMessage}</p>
			</div>
		</div>
	{/if}

	<p class="mb-6 text-gray-600">
		アップロードした動画の映像・音声を時間軸の逆順に並べ替えた MP4
		をブラウザ内で生成します。長い動画はメモリを大量に消費するため、まずは短いクリップで試してください。
	</p>

	<div
		role="button"
		tabindex="0"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onclick={() => document.getElementById('reverse-video-input')?.click()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('reverse-video-input')?.click();
			}
		}}
		class="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50 {dragOver
			? 'scale-105 border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon
			icon="mdi:video-input-antenna"
			class="mb-4 h-16 w-16 transition-colors {dragOver ? 'text-blue-500' : 'text-gray-400'}"
		/>
		<h3 class="mb-2 text-lg font-medium text-gray-700">
			{dragOver ? '動画をここにドロップ' : '動画ファイルを選択'}
		</h3>
		<p class="mb-4 text-sm text-gray-600">ドラッグ&ドロップ、またはクリックで選択</p>
		<button
			type="button"
			class="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			<Icon icon="mdi:folder-open" class="mr-2 inline h-5 w-5" />
			ファイルを選択
		</button>
		<p class="mt-3 text-xs text-gray-500">MP4 / WebM / MOV など FFmpeg が読める形式</p>
		<input
			id="reverse-video-input"
			type="file"
			accept="video/*"
			onchange={handleFileSelect}
			class="hidden"
		/>
	</div>

	{#if originalVideoUrl}
		<div class="mb-6 space-y-6">
			<div class="flex flex-wrap items-center justify-center gap-4">
				<button
					onclick={convertReverse}
					disabled={isConverting || isLoading || !ffmpeg?.loaded}
					class="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isConverting}
						<div class="flex items-center">
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							変換中… {conversionProgress}%
						</div>
					{:else}
						<Icon icon="mdi:backup-restore" class="mr-2 inline h-5 w-5" />
						逆再生用に変換
					{/if}
				</button>
				<button
					onclick={clearAll}
					disabled={isConverting}
					class="rounded bg-gray-500 px-6 py-3 text-white hover:bg-gray-600 disabled:opacity-50"
				>
					クリア
				</button>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h3 class="mb-3 font-medium text-gray-900">元の動画</h3>
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={originalVideoEl}
						src={originalVideoUrl}
						controls
						onloadedmetadata={onVideoLoaded}
						class="w-full rounded bg-gray-100"
					></video>
					{#if videoInfo.size > 0}
						<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<span class="text-gray-500">サイズ:</span>
								{formatFileSize(videoInfo.size)}
							</div>
							<div>
								<span class="text-gray-500">長さ:</span>
								{formatDuration(videoInfo.duration)}
							</div>
						</div>
					{/if}
				</div>

				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h3 class="font-medium text-gray-900">逆再生（結果）</h3>
						{#if reversedVideoUrl}
							<button
								onclick={downloadReversed}
								class="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
							>
								<Icon icon="mdi:download" class="mr-1 inline h-4 w-4" />
								ダウンロード
							</button>
						{/if}
					</div>

					{#if reversedVideoUrl}
						<!-- svelte-ignore a11y_media_has_caption -->
						<video src={reversedVideoUrl} controls class="w-full rounded bg-gray-100"></video>
						{#if usedAudioReverse}
							<p class="mt-2 text-xs text-gray-500">映像・音声の両方を逆順にしています。</p>
						{:else}
							<p class="mt-2 text-xs text-gray-500">
								映像のみ逆順です（音声トラックなし、または音声の逆順に失敗した場合）。
							</p>
						{/if}
					{:else if isConverting}
						<div class="flex min-h-40 flex-col items-center justify-center rounded bg-gray-100 p-4">
							<div class="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
							<p class="text-gray-600">変換中… {conversionProgress}%</p>
							<div class="mx-auto mt-2 h-2 w-full max-w-xs rounded-full bg-gray-200">
								<div
									class="h-2 rounded-full bg-blue-600 transition-all duration-300"
									style="width: {conversionProgress}%"
								></div>
							</div>
							{#if progressMessage}
								<p class="mt-2 max-w-full truncate text-xs text-gray-500">{progressMessage}</p>
							{/if}
						</div>
					{:else}
						<div
							class="flex min-h-40 items-center justify-center rounded bg-gray-100 text-gray-500"
						>
							<p class="text-center text-sm">
								「逆再生用に変換」を実行するとプレビューが表示されます
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-medium text-gray-900">
			<Icon icon="mdi:information-outline" class="mr-2 inline h-5 w-5" />
			使い方
		</h3>
		<ol class="list-inside list-decimal space-y-2 text-sm text-gray-600">
			<li>動画を選択します</li>
			<li>「逆再生用に変換」を押します（完了までしばらく待ちます）</li>
			<li>右側のプレビューで確認し、必要ならダウンロードします</li>
		</ol>
		<div class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
			<Icon icon="mdi:lightbulb-outline" class="mr-1 inline h-4 w-4" />
			処理はすべてこのブラウザ内で行われ、ファイルがサーバーに送られることはありません。逆順フィルタは全体をバッファするため、長尺・高解像度ほどメモリを使います。
		</div>
	</div>
</div>
