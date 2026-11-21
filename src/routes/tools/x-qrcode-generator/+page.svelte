<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onDestroy } from 'svelte';
	import { fetchQrBlob, getQrCodeUrl, loadQrCodeImage } from '../_shared/qrcode';
	import { cleanUsername, validateUsername } from './username-validation';

	const tool = tools.find((t) => t.name === 'x-qrcode-generator');
	let username = '';
	let profileName = '';
	let qrUrl = '';
	let canvasRef: HTMLCanvasElement;
	let showXIcon = true;
	let isLoading = false;
	let errorMessage = '';
	let generationId = 0;

	onDestroy(() => generationId++);

	$: profileName = validateUsername(username) ? cleanUsername(username) : '';
	$: generateQR(username, profileName, showXIcon, canvasRef);

	async function generateQR(
		value: string,
		name: string,
		includeIcon: boolean,
		canvas: HTMLCanvasElement
	) {
		const id = ++generationId;
		qrUrl = '';
		errorMessage = '';
		isLoading = false;
		if (!value) return;
		if (!name) {
			errorMessage = 'ユーザー名は英数字とアンダースコアのみ、15文字以内で入力してください。';
			return;
		}
		if (!canvas) return;

		isLoading = true;
		const url = getQrCodeUrl(`https://x.com/${name}`);
		try {
			const image = await loadQrCodeImage(url, includeIcon);
			if (id !== generationId) return;
			if (includeIcon) drawXIcon(canvas, image);
			qrUrl = url;
		} catch {
			if (id === generationId) errorMessage = 'QRコードの生成に失敗しました。';
		} finally {
			if (id === generationId) isLoading = false;
		}
	}

	function drawXIcon(canvas: HTMLCanvasElement, image: HTMLImageElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvasの初期化に失敗しました');
		canvas.width = 600;
		canvas.height = 600;
		ctx.drawImage(image, 0, 0, 600, 600);

		ctx.fillStyle = 'white';
		ctx.beginPath();
		ctx.roundRect(235, 235, 130, 130, 8);
		ctx.fill();

		ctx.fillStyle = 'black';
		ctx.beginPath();
		ctx.roundRect(250, 250, 100, 100, 8);
		ctx.fill();

		ctx.fillStyle = 'white';
		ctx.font = 'bold 60px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('𝕏', 300, 300);
	}

	async function downloadQRCode() {
		if (!qrUrl || isLoading) return;
		const id = generationId;
		let blobUrl: string | undefined;
		try {
			const link = document.createElement('a');
			link.download = `x-qrcode-${profileName}.png`;
			if (showXIcon) {
				link.href = canvasRef.toDataURL('image/png');
			} else {
				const blob = await fetchQrBlob(qrUrl);
				if (id !== generationId) return;
				blobUrl = URL.createObjectURL(blob);
				link.href = blobUrl;
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

	<div class="mb-4">
		<label for="username" class="mb-2 block text-sm font-medium text-gray-700">Xユーザー名</label>
		<input
			id="username"
			bind:value={username}
			placeholder="例: username または @username"
			class="w-full rounded-lg border border-gray-300 p-3"
		/>
	</div>

	<div class="mb-4">
		<label class="flex items-center">
			<input type="checkbox" bind:checked={showXIcon} class="mr-2" />
			<span class="text-sm text-gray-700"
				>中央にXアイコンを表示（誤ったユーザーになる場合は非表示にしてください）</span
			>
		</label>
	</div>

	{#if username}
		{#if profileName}
			<div class="mb-4 rounded-lg bg-gray-50 p-3">
				<p class="text-sm text-gray-600">
					プロフィールURL: <span class="font-mono">https://x.com/{profileName}</span>
				</p>
			</div>
		{/if}

		<div class="flex flex-col items-center">
			<!-- Loading中に非表示になると、canvasRefが失われるので、else if節にしてはいけない -->
			<canvas
				bind:this={canvasRef}
				class="h-auto w-full max-w-xs rounded-lg border border-gray-300 {showXIcon &&
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
			{:else if qrUrl && !showXIcon}
				<img
					src={qrUrl}
					alt="QRコード"
					class="h-auto w-full max-w-xs rounded-lg border border-gray-300"
				/>
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
