<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { FFmpeg as FFmpegType } from '@ffmpeg/ffmpeg';

	const tool = tools.find((t) => t.name === 'video-to-audio');

	// 状態管理
	let ffmpeg: FFmpegType | null = $state(null);
	let isLoading = $state(false);
	let isConverting = $state(false);
	let conversionProgress = $state(0);
	let progressMessage = $state('');
	let dragOver = $state(false);
	let errorMessage = $state('');
	let warningMessage = $state('');

	// ファイル関連
	let originalFile: File | null = $state(null);
	let originalVideoUrl: string | null = $state(null);
	let convertedAudioUrl: string | null = $state(null);
	let originalVideoEl: HTMLVideoElement | undefined = $state(undefined);

	// 変換設定
	let outputFormat = $state('mp3');
	let audioBitrate = $state(192);
	let sampleRate = $state(44100);

	// 動画情報
	let videoInfo = $state({
		duration: 0,
		size: 0
	});

	// 出力形式の選択肢
	const outputFormats = [
		{ value: 'mp3', label: 'MP3', description: '最も互換性が高い形式' },
		{ value: 'aac', label: 'AAC (M4A)', description: 'Apple製品で推奨' },
		{ value: 'wav', label: 'WAV', description: '無圧縮・高品質' },
		{ value: 'ogg', label: 'OGG Vorbis', description: 'オープン形式' },
		{ value: 'flac', label: 'FLAC', description: 'ロスレス圧縮' }
	];

	// ビットレートの選択肢
	const bitrateOptions = [
		{ value: 128, label: '128 kbps', description: '標準品質' },
		{ value: 192, label: '192 kbps', description: '高品質（推奨）' },
		{ value: 256, label: '256 kbps', description: '高音質' },
		{ value: 320, label: '320 kbps', description: '最高品質' }
	];

	// サンプルレートの選択肢
	const sampleRateOptions = [
		{ value: 22050, label: '22.05 kHz', description: '音声向け' },
		{ value: 44100, label: '44.1 kHz', description: 'CD品質（推奨）' },
		{ value: 48000, label: '48 kHz', description: 'プロ品質' }
	];

	// ファイルサイズ警告しきい値（500MB以上で警告）
	const FILE_SIZE_WARNING_THRESHOLD = 500 * 1024 * 1024;

	// 有効な設定値（ホワイトリスト）
	const VALID_FORMATS = ['mp3', 'aac', 'wav', 'ogg', 'flac'];
	const VALID_BITRATES = [128, 192, 256, 320];
	const VALID_SAMPLE_RATES = [22050, 44100, 48000];

	// FFmpegの読み込み
	async function loadFFmpeg() {
		if (!browser) return;

		isLoading = true;
		errorMessage = '';

		try {
			const { FFmpeg } = await import('@ffmpeg/ffmpeg');
			const { toBlobURL } = await import('@ffmpeg/util');

			const ffmpegInstance = new FFmpeg();

			// 進捗イベントのリスナー
			ffmpegInstance.on('log', ({ message }) => {
				progressMessage = message;
				// 時間情報から進捗を計算
				const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})/);
				if (timeMatch && videoInfo.duration > 0) {
					const hours = parseInt(timeMatch[1], 10);
					const minutes = parseInt(timeMatch[2], 10);
					const seconds = parseInt(timeMatch[3], 10);
					const currentTime = hours * 3600 + minutes * 60 + seconds;
					conversionProgress = Math.min(Math.round((currentTime / videoInfo.duration) * 100), 99);
				}
			});

			// FFmpegコアをCDNから読み込み
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

	// 初期化
	onMount(() => {
		loadFFmpeg();
	});

	// クリーンアップ
	onDestroy(() => {
		revokeUrls();
		if (ffmpeg) {
			try {
				ffmpeg.terminate();
			} catch {
				// 終了時のエラーは無視
			}
		}
	});

	function revokeUrls() {
		if (originalVideoUrl) {
			URL.revokeObjectURL(originalVideoUrl);
			originalVideoUrl = null;
		}
		if (convertedAudioUrl) {
			URL.revokeObjectURL(convertedAudioUrl);
			convertedAudioUrl = null;
		}
	}

	// ファイル選択処理
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
			errorMessage = '動画ファイルを選択してください';
			return;
		}

		// 前回のファイルをクリア
		clearAll();

		// ファイルサイズの警告チェック
		if (file.size > FILE_SIZE_WARNING_THRESHOLD) {
			const sizeMB = Math.round(file.size / 1024 / 1024);
			warningMessage = `ファイルサイズが大きいため（${sizeMB}MB）、変換に時間がかかる場合があります。ブラウザがメモリ不足になる可能性もあります。`;
		}

		originalFile = file;
		originalVideoUrl = URL.createObjectURL(file);
		videoInfo.size = file.size;
		errorMessage = '';
	}

	// 動画情報の更新
	function onVideoLoaded() {
		if (originalVideoEl) {
			videoInfo.duration = originalVideoEl.duration;
		}
	}

	// 音声変換処理
	async function convertToAudio() {
		if (!ffmpeg || !ffmpeg.loaded || !originalFile) {
			errorMessage = 'FFmpegが読み込まれていないか、ファイルが選択されていません';
			return;
		}

		isConverting = true;
		conversionProgress = 0;
		progressMessage = '変換を準備しています...';
		errorMessage = '';

		let inputFileName = '';
		let outputFileName = '';

		try {
			// ファイルをFFmpegに書き込み
			const fileData = new Uint8Array(await originalFile.arrayBuffer());
			inputFileName = 'input' + getFileExtension(originalFile.name);
			await ffmpeg.writeFile(inputFileName, fileData);

			progressMessage = '音声を抽出しています...';

			// 出力ファイル名を決定
			outputFileName = `output.${getOutputExtension(outputFormat)}`;

			// FFmpegコマンドを構築（入力検証付き）
			const ffmpegArgs = buildFFmpegArgs(inputFileName, outputFileName);

			// 変換実行
			await ffmpeg.exec(ffmpegArgs);

			// 結果を読み込み
			const outputData = await ffmpeg.readFile(outputFileName);

			// 型安全な処理（FFmpegはバイナリに対してUint8Arrayを返す）
			if (!(outputData instanceof Uint8Array)) {
				throw new Error('FFmpegから予期しない出力形式が返されました');
			}

			const blob = new Blob([outputData], { type: getMimeType(outputFormat) });
			if (convertedAudioUrl) {
				URL.revokeObjectURL(convertedAudioUrl);
			}
			convertedAudioUrl = URL.createObjectURL(blob);

			conversionProgress = 100;
			progressMessage = '変換が完了しました！';
		} catch (error) {
			console.error('Conversion error:', error);

			// エラーの種類に応じたメッセージ
			let message = '変換に失敗しました';
			if (error instanceof Error) {
				if (error.message.includes('Invalid data') || error.message.includes('Invalid input')) {
					message = '動画ファイルが破損しているか、対応していない形式です';
				} else if (error.message.includes('memory') || error.message.includes('Memory')) {
					message = 'メモリ不足です。より小さいファイルをお試しください';
				} else {
					message = `変換に失敗しました: ${error.message}`;
				}
			}
			errorMessage = message;
		} finally {
			// FFmpeg仮想ファイルシステムのクリーンアップ
			if (ffmpeg) {
				try {
					if (inputFileName) await ffmpeg.deleteFile(inputFileName);
				} catch {
					// クリーンアップエラーは無視
				}
				try {
					if (outputFileName) await ffmpeg.deleteFile(outputFileName);
				} catch {
					// クリーンアップエラーは無視
				}
			}
			isConverting = false;
		}
	}

	// FFmpegコマンドの構築（入力検証付き）
	function buildFFmpegArgs(inputFile: string, outputFile: string): string[] {
		// 入力検証（ホワイトリストによるコマンドインジェクション対策）
		if (!VALID_FORMATS.includes(outputFormat)) {
			throw new Error('無効な出力形式が指定されました');
		}
		if (!VALID_BITRATES.includes(audioBitrate)) {
			throw new Error('無効なビットレートが指定されました');
		}
		if (!VALID_SAMPLE_RATES.includes(sampleRate)) {
			throw new Error('無効なサンプルレートが指定されました');
		}

		const args = ['-i', inputFile];

		// 映像を除外し音声のみ抽出
		args.push('-vn');

		// 形式ごとのオプション
		switch (outputFormat) {
			case 'mp3':
				args.push('-acodec', 'libmp3lame');
				args.push('-b:a', `${audioBitrate}k`);
				break;
			case 'aac':
				args.push('-acodec', 'aac');
				args.push('-b:a', `${audioBitrate}k`);
				break;
			case 'wav':
				args.push('-acodec', 'pcm_s16le');
				break;
			case 'ogg':
				args.push('-acodec', 'libvorbis');
				args.push('-b:a', `${audioBitrate}k`);
				break;
			case 'flac':
				args.push('-acodec', 'flac');
				break;
		}

		// サンプルレート（WAVとFLAC以外）
		if (outputFormat !== 'wav' && outputFormat !== 'flac') {
			args.push('-ar', sampleRate.toString());
		}

		// 出力ファイル
		args.push(outputFile);

		return args;
	}

	// ファイル拡張子の取得
	function getFileExtension(filename: string): string {
		const match = filename.match(/\.[^.]+$/);
		return match ? match[0] : '.mp4';
	}

	// 出力拡張子の取得
	function getOutputExtension(format: string): string {
		const extensions: Record<string, string> = {
			mp3: 'mp3',
			aac: 'm4a',
			wav: 'wav',
			ogg: 'ogg',
			flac: 'flac'
		};
		return extensions[format] || 'mp3';
	}

	// MIMEタイプの取得
	function getMimeType(format: string): string {
		const mimeTypes: Record<string, string> = {
			mp3: 'audio/mpeg',
			aac: 'audio/mp4',
			wav: 'audio/wav',
			ogg: 'audio/ogg',
			flac: 'audio/flac'
		};
		return mimeTypes[format] || 'audio/mpeg';
	}

	// ダウンロード
	function downloadAudio() {
		if (!convertedAudioUrl || !originalFile) return;

		const baseName = originalFile.name.replace(/\.[^.]+$/, '');
		const extension = getOutputExtension(outputFormat);

		const a = document.createElement('a');
		a.href = convertedAudioUrl;
		a.download = `${baseName}.${extension}`;
		a.click();
	}

	// クリア
	function clearAll() {
		revokeUrls();
		originalFile = null;
		convertedAudioUrl = null;
		conversionProgress = 0;
		progressMessage = '';
		errorMessage = '';
		warningMessage = '';
		videoInfo = { duration: 0, size: 0 };
	}

	// ユーティリティ関数
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

	<!-- FFmpeg読み込み中の表示 -->
	{#if isLoading}
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
			<div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<p class="text-blue-700">FFmpegを読み込んでいます...</p>
			<p class="mt-1 text-sm text-blue-600">初回読み込みには少し時間がかかる場合があります</p>
		</div>
	{/if}

	<!-- エラーメッセージ -->
	{#if errorMessage}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<Icon icon="mdi:alert-circle" class="mr-2 h-5 w-5 text-red-600" />
				<p class="text-red-700">{errorMessage}</p>
			</div>
		</div>
	{/if}

	<!-- 警告メッセージ -->
	{#if warningMessage}
		<div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
			<div class="flex items-start">
				<Icon icon="mdi:alert" class="mr-2 h-5 w-5 flex-shrink-0 text-yellow-600" />
				<p class="text-yellow-800">{warningMessage}</p>
			</div>
		</div>
	{/if}

	<!-- 変換設定 -->
	<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
		<!-- 出力形式 -->
		<div class="rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-medium text-gray-900">出力形式</h3>
			<select
				bind:value={outputFormat}
				disabled={isConverting}
				class="w-full rounded border border-gray-300 px-3 py-2"
			>
				{#each outputFormats as format (format.value)}
					<option value={format.value}>{format.label} - {format.description}</option>
				{/each}
			</select>
		</div>

		<!-- ビットレート（非可逆形式のみ） -->
		{#if outputFormat !== 'wav' && outputFormat !== 'flac'}
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">ビットレート</h3>
				<select
					bind:value={audioBitrate}
					disabled={isConverting}
					class="w-full rounded border border-gray-300 px-3 py-2"
				>
					{#each bitrateOptions as option (option.value)}
						<option value={option.value}>{option.label} - {option.description}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- サンプルレート（WAVとFLAC以外） -->
		{#if outputFormat !== 'wav' && outputFormat !== 'flac'}
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">サンプルレート</h3>
				<select
					bind:value={sampleRate}
					disabled={isConverting}
					class="w-full rounded border border-gray-300 px-3 py-2"
				>
					{#each sampleRateOptions as option (option.value)}
						<option value={option.value}>{option.label} - {option.description}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	<!-- ファイル選択エリア -->
	<div
		role="button"
		tabindex="0"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={handleDrop}
		onclick={() => document.getElementById('video-file-input')?.click()}
		onkeydown={(e) => {
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
			icon="mdi:video-input-antenna"
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
			<p class="text-xs text-gray-500">対応形式: MP4, WebM, AVI, MOV, MKV, FLV など</p>
		</div>
		<input
			id="video-file-input"
			type="file"
			accept="video/*"
			onchange={handleFileSelect}
			class="hidden"
		/>
	</div>

	<!-- 動画プレビューと変換 -->
	{#if originalVideoUrl}
		<div class="mb-6 space-y-6">
			<!-- アクションボタン -->
			<div class="flex items-center justify-center gap-4">
				<button
					onclick={convertToAudio}
					disabled={isConverting || isLoading || !ffmpeg?.loaded}
					class="rounded bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isConverting}
						<div class="flex items-center">
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							変換中... {conversionProgress}%
						</div>
					{:else}
						<Icon icon="mdi:music-note" class="mr-2 inline h-5 w-5" />
						音声を抽出
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

			<!-- プレビューエリア -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- 元動画 -->
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<h3 class="mb-3 font-medium text-gray-900">元動画</h3>
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
								<span class="text-gray-500">ファイルサイズ:</span>
								{formatFileSize(videoInfo.size)}
							</div>
							<div>
								<span class="text-gray-500">長さ:</span>
								{formatDuration(videoInfo.duration)}
							</div>
						</div>
					{/if}
				</div>

				<!-- 変換結果 -->
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="font-medium text-gray-900">変換結果</h3>
						{#if convertedAudioUrl}
							<button
								onclick={downloadAudio}
								class="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
							>
								<Icon icon="mdi:download" class="mr-1 inline h-4 w-4" />
								ダウンロード
							</button>
						{/if}
					</div>

					{#if convertedAudioUrl}
						<div class="rounded bg-gray-100 p-4">
							<audio src={convertedAudioUrl} controls class="w-full"></audio>
							<div class="mt-3 text-center">
								<span
									class="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm text-green-800"
								>
									<Icon icon="mdi:check" class="mr-1 h-4 w-4" />
									{outputFormats.find((f) => f.value === outputFormat)?.label} 形式で変換完了
								</span>
							</div>
						</div>
					{:else if isConverting}
						<div class="flex h-32 flex-col items-center justify-center rounded bg-gray-100">
							<div class="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
							<p class="text-gray-600">変換中... {conversionProgress}%</p>
							<div class="mx-auto mt-2 h-2 w-48 rounded-full bg-gray-200">
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
						<div class="flex h-32 items-center justify-center rounded bg-gray-100 text-gray-500">
							<div class="text-center">
								<Icon icon="mdi:music-note-outline" class="mx-auto mb-2 h-12 w-12 text-gray-300" />
								<p>変換を実行すると、音声がここに表示されます</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- 使い方の説明 -->
	<div class="rounded-lg border border-gray-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-medium text-gray-900">
			<Icon icon="mdi:information-outline" class="mr-2 inline h-5 w-5" />
			使い方
		</h3>
		<ol class="list-inside list-decimal space-y-2 text-sm text-gray-600">
			<li>動画ファイルをドラッグ&ドロップするか、クリックして選択します</li>
			<li>出力形式（MP3, AAC, WAV など）を選択します</li>
			<li>必要に応じてビットレートとサンプルレートを調整します</li>
			<li>「音声を抽出」ボタンをクリックして変換を開始します</li>
			<li>変換完了後、「ダウンロード」ボタンで音声ファイルを保存します</li>
		</ol>
		<div class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
			<Icon icon="mdi:lightbulb-outline" class="mr-1 inline h-4 w-4" />
			<strong>ヒント:</strong> すべての処理はブラウザ内で完結するため、動画ファイルがサーバーにアップロードされることはありません。
		</div>
	</div>
</div>
