<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	let username = '';
	let qrUrl = '';
	let canvasRef: HTMLCanvasElement;
	let showXIcon = true;
	let isLoading = false;

	$: {
		if (username) {
			// Remove @ if present
			const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
			const profileUrl = `https://x.com/${cleanUsername}`;
			qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&ecc=H&margin=6&data=${encodeURIComponent(profileUrl)}`;
		}
	}

	$: if (username) {
		isLoading = true;
	}

	// Handle QR generation when username changes
	$: if (username && !showXIcon) {
		isLoading = true;
		// For non-icon QR codes, preload the image to detect when it's ready
		const img = new Image();
		img.onload = () => {
			isLoading = false;
		};
		img.onerror = () => {
			isLoading = false;
		};
		img.src = qrUrl;
	}

	const tool = tools.find((t) => t.name === 'x-qrcode-generator');

	function generateXQR() {
		if (!username || !canvasRef) return;

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

			// Draw X logo only if enabled
			if (showXIcon) {
				const logoSize = 100;
				const padding = 15;
				const totalSize = logoSize + padding * 2;
				const x = (600 - totalSize) / 2;
				const y = (600 - totalSize) / 2;
				const radius = 8;

				// Draw white background with padding and rounded corners
				ctx.fillStyle = 'white';
				ctx.beginPath();
				ctx.roundRect(x, y, totalSize, totalSize, radius);
				ctx.fill();

				// Draw black rounded square for X logo
				ctx.fillStyle = 'black';
				ctx.beginPath();
				ctx.roundRect(x + padding, y + padding, logoSize, logoSize, radius);
				ctx.fill();

				// Draw white X logo
				ctx.fillStyle = 'white';
				ctx.font = 'bold 60px Arial';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText('𝕏', 300, 300);
			}
			isLoading = false;
		};
		qrImg.onerror = () => {
			isLoading = false;
		};
		qrImg.src = qrUrl;
	}

	$: if (username && showXIcon) {
		generateXQR();
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
		{@const cleanUsername = username.startsWith('@') ? username.slice(1) : username}
		<div class="mb-4 rounded-lg bg-gray-50 p-3">
			<p class="text-sm text-gray-600">
				プロフィールURL: <span class="font-mono">https://x.com/{cleanUsername}</span>
			</p>
		</div>

		<div class="flex justify-center">
			<!-- Loading中に非表示になると、canvasRefが失われるので、else if節にしてはいけない -->
			<canvas
				bind:this={canvasRef}
				class="max-w-xs rounded-lg border border-gray-300 {showXIcon && !isLoading ? '' : 'hidden'}"
			></canvas>
			{#if isLoading}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-gray-300 p-8"
				>
					<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
					<p class="text-gray-600">QRコードを生成中...</p>
				</div>
			{:else if !showXIcon}
				<img src={qrUrl} alt="QRコード" class="max-w-xs rounded-lg border border-gray-300" />
			{/if}
		</div>
	{/if}
</div>
