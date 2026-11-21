<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import { detectBase64ImageMimeType, imageFileExtension } from './image-format';

	const tool = tools.find((t) => t.name === 'base64-converter');

	// 画像 → Base64 変換用
	let selectedFile: File | null = null;
	let dragOver = false;
	let imagePreviewUrl: string | null = null;
	let imageDataUrl = '';
	let base64Result = '';
	let includeDataUrl = true;

	// Base64 → 画像 変換用
	let base64Input = '';
	let convertedImageUrl: string | null = null;
	let convertedImageName = 'converted-image.png';

	// 共通
	let activeTab: 'to-base64' | 'to-image' = 'to-base64';
	let isLoading = false;
	let conversionId = 0;
	let pendingReader: FileReader | null = null;

	function cancelPendingConversion() {
		conversionId += 1;
		pendingReader?.abort();
		pendingReader = null;
		isLoading = false;
	}

	function selectTab(tab: typeof activeTab) {
		if (activeTab === tab) return;
		cancelPendingConversion();
		activeTab = tab;
	}

	function revokeObjectUrls() {
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);
	}

	onDestroy(() => {
		cancelPendingConversion();
		revokeObjectUrls();
	});

	// 画像 → Base64 変換
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

	function imageFileFromBlob(blob: Blob): File {
		const ext = blob.type.split('/')[1]?.split('+')[0] || 'png';
		return new File([blob], `clipboard-image.${ext}`, { type: blob.type });
	}

	async function readClipboardImage() {
		if (!navigator.clipboard?.read) {
			alert(
				'このブラウザはクリップボードの読み取りに対応していません。Ctrl+V（⌘+V）で貼り付けてください'
			);
			return;
		}

		cancelPendingConversion();
		const id = conversionId;
		isLoading = true;
		try {
			const items = await navigator.clipboard.read();
			if (id !== conversionId) return;
			for (const item of items) {
				const imageType = item.types.find((type) => type.startsWith('image/'));
				if (imageType) {
					const blob = await item.getType(imageType);
					if (id === conversionId) processFile(imageFileFromBlob(blob));
					return;
				}
			}
			alert('クリップボードに画像がありません');
		} catch (err) {
			if (id !== conversionId) return;
			console.error('クリップボードの読み取りに失敗:', err);
			alert(
				'クリップボードの読み取りに失敗しました。ブラウザの権限を確認するか、Ctrl+V（⌘+V）で貼り付けてください'
			);
		} finally {
			if (id === conversionId) isLoading = false;
		}
	}

	function handlePaste(e: ClipboardEvent) {
		if (activeTab !== 'to-base64') return;
		const items = Array.from(e.clipboardData?.items ?? []);
		const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
		const blob = imageItem?.getAsFile();
		if (!blob) return;
		e.preventDefault();
		processFile(blob.name ? blob : imageFileFromBlob(blob));
	}

	function processFile(file: File) {
		if (!file.type.startsWith('image/')) {
			alert('画像ファイルを選択してください');
			return;
		}

		// ファイルサイズ制限（10MB）
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		if (file.size > MAX_FILE_SIZE) {
			alert(
				`ファイルサイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(2)}MB）。最大${MAX_FILE_SIZE / 1024 / 1024}MBまでです。`
			);
			return;
		}

		cancelPendingConversion();
		selectedFile = file;

		// プレビュー用URL作成
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		imagePreviewUrl = URL.createObjectURL(file);

		// Base64変換
		convertImageToBase64(file);
	}

	function convertImageToBase64(file: File) {
		isLoading = true;
		imageDataUrl = '';
		const id = conversionId;
		const reader = new FileReader();
		pendingReader = reader;

		reader.onload = () => {
			if (id !== conversionId) return;
			pendingReader = null;
			imageDataUrl = reader.result as string;
			isLoading = false;
		};

		reader.onerror = () => {
			if (id !== conversionId) return;
			pendingReader = null;
			isLoading = false;
			alert('ファイルの読み込みに失敗しました');
		};

		reader.readAsDataURL(file);
	}

	// Base64 → 画像 変換
	function convertBase64ToImage() {
		const input = base64Input.trim();
		if (!input) {
			alert('Base64文字列を入力してください');
			return;
		}

		// Base64文字列サイズ制限（20MB相当）
		const MAX_BASE64_LENGTH = 20 * 1024 * 1024; // 20MB相当
		if (base64Input.length > MAX_BASE64_LENGTH) {
			alert(
				`Base64文字列が長すぎます（${(base64Input.length / 1024 / 1024).toFixed(2)}MB相当）。最大${MAX_BASE64_LENGTH / 1024 / 1024}MB相当までです。`
			);
			return;
		}

		cancelPendingConversion();
		const id = conversionId;
		isLoading = true;

		try {
			let dataUrl: string;

			// Data URL形式かBase64文字列のみかを判定
			if (input.startsWith('data:image/')) {
				dataUrl = input;
			} else {
				const mimeType = detectBase64ImageMimeType(input) ?? 'image/png';
				dataUrl = `data:${mimeType};base64,${input}`;
			}

			// 画像の有効性を検証
			const img = new Image();
			img.onload = async () => {
				if (id !== conversionId) return;
				try {
					const response = await fetch(dataUrl);
					const blob = await response.blob();
					if (id !== conversionId) return;

					const nextUrl = URL.createObjectURL(blob);
					if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);
					convertedImageUrl = nextUrl;
					convertedImageName = `converted-image.${imageFileExtension(blob.type)}`;
				} catch {
					if (id === conversionId) alert('画像の変換に失敗しました');
				} finally {
					if (id === conversionId) isLoading = false;
				}
			};

			img.onerror = () => {
				if (id !== conversionId) return;
				isLoading = false;
				alert('無効なBase64画像データです');
			};

			img.src = dataUrl;
		} catch {
			isLoading = false;
			alert('Base64データの形式が正しくありません');
		}
	}

	function downloadImage() {
		if (!convertedImageUrl) return;

		const a = document.createElement('a');
		a.href = convertedImageUrl;
		a.download = convertedImageName;
		a.click();
	}

	function clearAll() {
		cancelPendingConversion();
		selectedFile = null;
		imageDataUrl = '';
		base64Input = '';

		revokeObjectUrls();
		imagePreviewUrl = null;
		convertedImageUrl = null;
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	$: {
		base64Result = includeDataUrl
			? imageDataUrl
			: imageDataUrl.slice(imageDataUrl.indexOf(',') + 1);
		if (base64Result) copyToClipboard(base64Result);
	}
</script>

<svelte:window on:paste={handlePaste} />

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- タブ切り替え -->
	<div class="mb-6 flex rounded-lg bg-gray-100 p-1">
		<button
			on:click={() => selectTab('to-base64')}
			class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {activeTab ===
			'to-base64'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-600 hover:text-gray-900'}"
		>
			画像 → Base64
		</button>
		<button
			on:click={() => selectTab('to-image')}
			class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {activeTab ===
			'to-image'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-600 hover:text-gray-900'}"
		>
			Base64 → 画像
		</button>
	</div>

	{#if activeTab === 'to-base64'}
		<!-- 画像 → Base64 変換 -->
		<div class="space-y-4">
			<!-- 設定オプション -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<label class="flex items-center">
					<input type="checkbox" bind:checked={includeDataUrl} class="mr-2" />
					<span class="text-sm font-medium text-gray-700"
						>Data URL形式で出力（data:image/...形式）</span
					>
				</label>
				<p class="mt-1 text-xs text-gray-500">チェックを外すとBase64文字列のみを出力します</p>
			</div>

			<!-- ファイル選択エリア -->
			<div
				role="button"
				tabindex="0"
				aria-label="ファイルをドラッグ&ドロップまたはクリックして選択"
				on:dragover|preventDefault={() => (dragOver = true)}
				on:dragleave={() => (dragOver = false)}
				on:drop={handleDrop}
				on:click={() => document.getElementById('file-input')?.click()}
				on:keydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						document.getElementById('file-input')?.click();
					}
				}}
				class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
					? 'border-blue-400 bg-blue-50'
					: 'border-gray-300 bg-gray-50'}"
			>
				<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
				<p class="mb-2 text-gray-700">画像ファイルをドラッグ＆ドロップ</p>
				<p class="mb-1 text-xs text-gray-500">PNG / JPEG / WebP / GIF</p>
				<p class="mb-3 text-xs text-gray-500">
					Ctrl+V（⌘+V）でクリップボードの画像も貼り付けできます
				</p>
				<input
					id="file-input"
					type="file"
					accept="image/*"
					on:change={handleFileSelect}
					class="block max-w-full"
				/>
			</div>

			<div class="flex justify-center">
				<button
					on:click={readClipboardImage}
					class="flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
				>
					<Icon icon="mdi:clipboard-arrow-down" class="mr-2 h-5 w-5" />
					クリップボードから画像を読み込む
				</button>
			</div>

			<!-- プレビューと結果 -->
			{#if imagePreviewUrl}
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<!-- 画像プレビュー -->
					<div class="rounded-lg border border-gray-200 bg-white p-4">
						<h3 class="mb-3 font-medium text-gray-900">元画像</h3>
						<img
							src={imagePreviewUrl}
							alt="プレビュー"
							class="h-48 w-full rounded bg-gray-50 object-contain"
						/>
						{#if selectedFile}
							<p class="mt-2 text-xs text-gray-500">
								{selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
							</p>
						{/if}
					</div>

					<!-- Base64結果 -->
					<div class="rounded-lg border border-gray-200 bg-white p-4">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="font-medium text-gray-900">Base64結果</h3>
							{#if base64Result}
								<button
									on:click={() => copyToClipboard(base64Result)}
									class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
								>
									コピー
								</button>
							{/if}
						</div>
						{#if isLoading}
							<div class="flex h-24 items-center justify-center">
								<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
							</div>
						{:else if base64Result}
							<textarea
								bind:value={base64Result}
								readonly
								class="h-32 w-full rounded border border-gray-300 bg-gray-50 p-2 font-mono text-xs"
								placeholder="Base64文字列がここに表示されます"
							></textarea>
							<p class="mt-2 text-xs text-gray-500">
								文字数: {base64Result.length.toLocaleString()}
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Base64 → 画像 変換 -->
		<div class="space-y-4">
			<!-- Base64入力 -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-medium text-gray-900">Base64文字列を入力</h3>
					<button
						on:click={convertBase64ToImage}
						disabled={!base64Input.trim() || isLoading}
						class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{#if isLoading}
							<div class="flex items-center">
								<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
								変換中...
							</div>
						{:else}
							画像に変換
						{/if}
					</button>
				</div>
				<textarea
					bind:value={base64Input}
					on:input={cancelPendingConversion}
					class="h-32 w-full rounded border border-gray-300 p-2 font-mono text-xs"
					placeholder="Base64文字列またはData URL（data:image/...）を貼り付けてください"
				></textarea>
				<p class="mt-1 text-xs text-gray-500">
					Data
					URL形式（data:image/png;base64,iVBORw0KGgoAAAANSUhE...）またはBase64文字列のみを入力できます
				</p>
			</div>

			<!-- 変換結果 -->
			{#if convertedImageUrl}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="font-medium text-gray-900">変換結果</h3>
						<button
							on:click={downloadImage}
							class="rounded bg-green-600 px-3 py-2 text-white hover:bg-green-700"
						>
							ダウンロード
						</button>
					</div>
					<img
						src={convertedImageUrl}
						alt="変換結果"
						class="h-64 w-full rounded bg-gray-50 object-contain"
					/>
					<p class="mt-2 text-xs text-gray-500">
						{convertedImageName}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- 共通アクション -->
	{#if selectedFile || base64Input || convertedImageUrl || isLoading}
		<div class="mt-6 flex justify-center">
			<button
				on:click={clearAll}
				class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
			>
				すべてクリア
			</button>
		</div>
	{/if}
</div>
