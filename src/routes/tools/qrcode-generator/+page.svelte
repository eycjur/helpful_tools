<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import { fetchQrBlob, getQrCodeUrl, loadQrImage } from '../_shared/qrcode';

	const tool = tools.find((t) => t.name === 'qrcode-generator');
	const MAX_INPUT_LENGTH = 2000;
	const MAX_LOGO_SIZE = 5 * 1024 * 1024;
	let input = '';
	let qrUrl = '';
	let logoFile: File | null = null;
	let logoDataUrl = '';
	let canvasRef: HTMLCanvasElement;
	let isLoading = false;
	let errorMessage = '';
	let logoError = '';
	let generationId = 0;

	onDestroy(() => {
		generationId++;
		logoFile = null;
	});

	$: generateQR(input, logoDataUrl, canvasRef);

	async function generateQR(text: string, logo: string, canvas: HTMLCanvasElement) {
		const id = ++generationId;
		qrUrl = '';
		errorMessage = '';
		isLoading = false;
		if (!text) return;
		if (Array.from(text).length > MAX_INPUT_LENGTH) {
			errorMessage = `入力は${MAX_INPUT_LENGTH}文字以内にしてください。`;
			return;
		}
		if (!canvas) return;

		isLoading = true;
		const url = getQrCodeUrl(text);
		try {
			const image = await loadQrImage(url, !!logo);
			if (id !== generationId) return;
			if (logo) {
				let logoImage: HTMLImageElement;
				try {
					logoImage = await loadQrImage(logo);
				} catch {
					throw new Error('ロゴ画像の読み込みに失敗しました。');
				}
				if (id !== generationId) return;
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('QRコードの生成に失敗しました。');
				canvas.width = 600;
				canvas.height = 600;
				ctx.drawImage(image, 0, 0, 600, 600);
				ctx.fillStyle = 'white';
				ctx.fillRect(245, 245, 110, 110);
				ctx.drawImage(logoImage, 250, 250, 100, 100);
			}
			qrUrl = url;
		} catch (error) {
			if (id === generationId) {
				errorMessage = error instanceof Error ? error.message : 'QRコードの生成に失敗しました。';
			}
		} finally {
			if (id === generationId) isLoading = false;
		}
	}

	function handleLogoUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		logoError = '';
		if (file.size > MAX_LOGO_SIZE) {
			logoError = 'ロゴ画像は5MB以下にしてください。';
			target.value = '';
			return;
		}

		logoFile = file;
		const reader = new FileReader();
		reader.onload = () => {
			if (logoFile === file && typeof reader.result === 'string') logoDataUrl = reader.result;
		};
		reader.onerror = () => {
			if (logoFile === file) logoError = 'ロゴ画像の読み込みに失敗しました。';
		};
		reader.readAsDataURL(file);
	}

	function removeLogo() {
		logoFile = null;
		logoDataUrl = '';
		logoError = '';
		const fileInput = document.getElementById('logo');
		if (fileInput instanceof HTMLInputElement) fileInput.value = '';
	}

	async function downloadQRCode() {
		if (!qrUrl || isLoading) return;
		const id = generationId;
		let blobUrl: string | undefined;
		try {
			const link = document.createElement('a');
			if (logoDataUrl) {
				link.href = canvasRef.toDataURL('image/png');
				link.download = 'qrcode-with-logo.png';
			} else {
				const blob = await fetchQrBlob(qrUrl);
				if (id !== generationId) return;
				blobUrl = URL.createObjectURL(blob);
				link.href = blobUrl;
				link.download = 'qrcode.png';
			}
			link.click();
		} catch {
			if (id === generationId) errorMessage = 'ダウンロードに失敗しました。';
		} finally {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
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
			{#if logoFile}
				<button
					on:click={removeLogo}
					class="rounded-lg bg-red-500 px-3 py-2 text-white transition-colors hover:bg-red-600"
					type="button"
				>
					削除
				</button>
			{/if}
		</div>
		{#if logoError}
			<p role="alert" class="mt-1 text-sm text-red-700">{logoError}</p>
		{/if}
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
				class="max-w-xs rounded-lg border border-gray-300 {logoDataUrl &&
				qrUrl &&
				!errorMessage &&
				!isLoading
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
			{:else if qrUrl && !logoDataUrl}
				<img src={qrUrl} alt="QRコード" class="max-w-xs rounded-lg border border-gray-300" />
			{/if}

			<!-- ダウンロードボタン -->
			{#if qrUrl && !isLoading && !errorMessage}
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

	<p class="mt-8 text-xs text-gray-500">QRコードは(株)デンソーウェーブの登録商標です。</p>
</div>
