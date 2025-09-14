<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';

	const tool = tools.find((t) => t.name === 'base64-converter');

	// 画像 → Base64 変換用
	let selectedFile: File | null = null;
	let dragOver = false;
	let imagePreviewUrl: string | null = null;
	let base64Result = '';
	let includeDataUrl = true;

	// Base64 → 画像 変換用
	let base64Input = '';
	let convertedImageUrl: string | null = null;
	let convertedImageName = 'converted-image.png';

	// 共通
	let activeTab: 'to-base64' | 'to-image' = 'to-base64';
	let isLoading = false;

	function revokeObjectUrls() {
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);
	}

	onDestroy(revokeObjectUrls);

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

	function processFile(file: File) {
		if (!file.type.startsWith('image/')) {
			alert('画像ファイルを選択してください');
			return;
		}

		selectedFile = file;

		// プレビュー用URL作成
		if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
		imagePreviewUrl = URL.createObjectURL(file);

		// Base64変換
		convertImageToBase64(file);
	}

	function convertImageToBase64(file: File) {
		isLoading = true;
		const reader = new FileReader();

		reader.onload = (e) => {
			const result = e.target?.result as string;
			if (includeDataUrl) {
				base64Result = result;
			} else {
				// Data URLプリフィックスを除去してBase64文字列のみにする
				const base64Data = result.split(',')[1];
				base64Result = base64Data;
			}
			isLoading = false;

			// 自動コピー
			copyToClipboard(base64Result);
		};

		reader.onerror = () => {
			isLoading = false;
			alert('ファイルの読み込みに失敗しました');
		};

		reader.readAsDataURL(file);
	}

	// Base64 → 画像 変換
	function convertBase64ToImage() {
		if (!base64Input.trim()) {
			alert('Base64文字列を入力してください');
			return;
		}

		isLoading = true;

		try {
			let dataUrl: string;

			// Data URL形式かBase64文字列のみかを判定
			if (base64Input.startsWith('data:image/')) {
				dataUrl = base64Input;
			} else {
				// Base64文字列のみの場合、Data URLに変換（デフォルトでPNG）
				dataUrl = `data:image/png;base64,${base64Input}`;
			}

			// 画像の有効性を検証
			const img = new Image();
			img.onload = () => {
				// 既存のURLを解放
				if (convertedImageUrl) URL.revokeObjectURL(convertedImageUrl);

				// BlobとしてURLを作成
				fetch(dataUrl)
					.then((res) => res.blob())
					.then((blob) => {
						convertedImageUrl = URL.createObjectURL(blob);

						// ファイル名を推定
						const mimeType = blob.type;
						const ext = mimeType.includes('jpeg')
							? 'jpg'
							: mimeType.includes('png')
								? 'png'
								: mimeType.includes('webp')
									? 'webp'
									: 'png';
						convertedImageName = `converted-image.${ext}`;

						isLoading = false;
					})
					.catch(() => {
						isLoading = false;
						alert('画像の変換に失敗しました');
					});
			};

			img.onerror = () => {
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
		selectedFile = null;
		base64Result = '';
		base64Input = '';

		if (imagePreviewUrl) {
			URL.revokeObjectURL(imagePreviewUrl);
			imagePreviewUrl = null;
		}

		if (convertedImageUrl) {
			URL.revokeObjectURL(convertedImageUrl);
			convertedImageUrl = null;
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- タブ切り替え -->
	<div class="mb-6 flex rounded-lg bg-gray-100 p-1">
		<button
			on:click={() => (activeTab = 'to-base64')}
			class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {activeTab ===
			'to-base64'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-600 hover:text-gray-900'}"
		>
			画像 → Base64
		</button>
		<button
			on:click={() => (activeTab = 'to-image')}
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
				on:dragover|preventDefault={() => (dragOver = true)}
				on:dragleave={() => (dragOver = false)}
				on:drop={handleDrop}
				class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
					? 'border-blue-400 bg-blue-50'
					: 'border-gray-300 bg-gray-50'}"
			>
				<Icon icon="mdi:cloud-upload" class="mb-2 h-12 w-12 text-gray-400" />
				<p class="mb-2 text-gray-700">画像ファイルをドラッグ＆ドロップ</p>
				<p class="mb-3 text-xs text-gray-500">PNG / JPEG / WebP / GIF</p>
				<input type="file" accept="image/*" on:change={handleFileSelect} class="block" />
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
	{#if selectedFile || base64Result || convertedImageUrl}
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
