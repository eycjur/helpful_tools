<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	let input = '';
	let qrUrl = '';
	let logoFile: File | null = null;
	let logoDataUrl = '';
	let canvasRef: HTMLCanvasElement;
	let isLoading = false;
	let errorMessage = '';

	// 入力サイズ制限（2000文字）
	const MAX_INPUT_LENGTH = 2000;

	$: {
		if (input.length > MAX_INPUT_LENGTH) {
			input = input.slice(0, MAX_INPUT_LENGTH);
			errorMessage = `入力は${MAX_INPUT_LENGTH}文字以内にしてください。`;
		}
		qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&margin=6&data=${encodeURIComponent(input)}`;
	}

	// Reset loading and error when input changes
	$: if (input) {
		isLoading = true;
		errorMessage = '';
	}

	// Handle QR generation when input changes
	$: if (input && !logoDataUrl) {
		// For non-logo QR codes, preload the image to detect when it's ready
		const img = new Image();
		img.onload = () => {
			isLoading = false;
		};
		img.onerror = () => {
			isLoading = false;
			errorMessage = 'QRコードの生成に失敗しました。';
		};
		img.src = qrUrl;
	}

	const tool = tools.find((t) => t.name === 'qrcode-generator');

	function handleLogoUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];

			// ファイルサイズ制限（5MB）
			const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
			if (file.size > MAX_LOGO_SIZE) {
				errorMessage = `ロゴ画像は${MAX_LOGO_SIZE / 1024 / 1024}MB以下にしてください。`;
				target.value = '';
				return;
			}

			logoFile = file;
			const reader = new FileReader();
			reader.onload = (e) => {
				const result = e.target?.result;
				if (typeof result === 'string') {
					logoDataUrl = result;
				}
			};
			reader.readAsDataURL(logoFile);
		}
	}

	function removeLogo() {
		logoFile = null;
		logoDataUrl = '';
		// Reset file input
		const fileInput = document.getElementById('logo');
		if (fileInput && fileInput instanceof HTMLInputElement) {
			fileInput.value = '';
		}
	}

	function generateQRWithLogo() {
		if (!input || !logoDataUrl || !canvasRef) return;

		// isLoading is already set to true by the reactive statement above
		const canvas = canvasRef;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			isLoading = false;
			return;
		}

		const qrImg = new Image();
		qrImg.crossOrigin = 'anonymous';
		qrImg.onload = () => {
			canvas.width = 600;
			canvas.height = 600;

			// Draw QR code
			ctx.drawImage(qrImg, 0, 0, 600, 600);

			// Draw logo
			const logoImg = new Image();
			logoImg.onload = () => {
				const logoSize = 100;
				const x = (600 - logoSize) / 2;
				const y = (600 - logoSize) / 2;

				// Draw white background for logo
				ctx.fillStyle = 'white';
				ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);

				// Draw logo
				ctx.drawImage(logoImg, x, y, logoSize, logoSize);
				isLoading = false;
			};
			logoImg.onerror = () => {
				isLoading = false;
				errorMessage = 'ロゴ画像の読み込みに失敗しました。';
			};
			logoImg.src = logoDataUrl;
		};
		qrImg.onerror = () => {
			isLoading = false;
			errorMessage = 'QRコードの生成に失敗しました。';
		};
		qrImg.src = qrUrl;
	}

	$: if (input && logoDataUrl) {
		generateQRWithLogo();
	}

	// QRコードをダウンロード
	async function downloadQRCode() {
		if (!input) return;

		try {
			let dataUrl: string;
			let filename: string;

			if (logoDataUrl && canvasRef) {
				// ロゴ付きの場合: canvasからダウンロード
				dataUrl = canvasRef.toDataURL('image/png');
				filename = 'qrcode-with-logo.png';
			} else {
				// ロゴなしの場合: 外部APIの画像をfetchしてダウンロード
				const response = await fetch(qrUrl);
				const blob = await response.blob();
				dataUrl = URL.createObjectURL(blob);
				filename = 'qrcode.png';

				// ダウンロード後にURLを解放
				const link = document.createElement('a');
				link.href = dataUrl;
				link.download = filename;
				link.click();
				URL.revokeObjectURL(dataUrl);
				return;
			}

			// canvasの場合のダウンロード
			const link = document.createElement('a');
			link.href = dataUrl;
			link.download = filename;
			link.click();
		} catch (error) {
			console.error('ダウンロードに失敗しました:', error);
			errorMessage = 'ダウンロードに失敗しました。';
		}
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>
	<input
		bind:value={input}
		placeholder="テキストを入力"
		class="mb-4 w-full rounded-lg border border-gray-300 p-3"
	/>

	<div class="mb-4">
		<label for="logo" class="mb-2 block text-sm font-medium text-gray-700"
			>ロゴ画像をアップロード（オプション）</label
		>
		<div class="flex gap-2">
			<input
				type="file"
				id="logo"
				accept="image/*"
				on:change={handleLogoUpload}
				class="flex-1 rounded-lg border border-gray-300 p-2"
			/>
			{#if logoDataUrl}
				<button
					on:click={removeLogo}
					class="rounded-lg bg-red-500 px-3 py-2 text-white transition-colors hover:bg-red-600"
					type="button"
				>
					削除
				</button>
			{/if}
		</div>
		{#if logoDataUrl}
			<p class="mt-1 text-xs text-gray-500">
				QRコード上に重ねることで、まれに誤読される可能性があります
			</p>
		{/if}
	</div>

	{#if input}
		<p class="mb-4 text-gray-700">↓ 生成されたQRコード：</p>
		<div class="flex flex-col items-center">
			<canvas
				bind:this={canvasRef}
				class="max-w-xs rounded-lg border border-gray-300 {logoDataUrl && !isLoading
					? ''
					: 'hidden'}"
			></canvas>
			{#if errorMessage}
				<div class="rounded-lg border border-red-300 bg-red-50 p-4">
					<div class="flex">
						<Icon icon="mdi:alert-circle" class="h-5 w-5 text-red-500" />
						<p class="ml-2 text-sm text-red-700">{errorMessage}</p>
					</div>
				</div>
			{:else if isLoading}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-8"
				>
					<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
					<p class="text-gray-600">QRコードを生成中...</p>
				</div>
			{:else if !logoDataUrl}
				<img src={qrUrl} alt="QRコード" class="max-w-xs rounded-lg border border-gray-300" />
			{/if}

			<!-- ダウンロードボタン -->
			{#if !isLoading && !errorMessage}
				<button
					on:click={downloadQRCode}
					class="mt-4 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
				>
					<Icon icon="mdi:download" class="h-5 w-5" />
					QRコードをダウンロード
				</button>
			{/if}
		</div>
	{/if}
</div>
