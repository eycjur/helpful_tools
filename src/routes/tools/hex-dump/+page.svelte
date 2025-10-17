<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	type ByteInfo = {
		offset: number;
		value: number;
		hex: string;
		ascii: string;
		description: string;
	};

	type HexLine = {
		offset: string;
		bytes: ByteInfo[];
	};

	const tool = tools.find((t) => t.name === 'hex-dump');

	let file = $state<File | null>(null);
	let hexLines = $state<HexLine[]>([]);
	let hexDump = $state('');
	let isProcessing = $state(false);
	let dragOver = $state(false);
	let copyFeedback = $state(false);
	let hoveredByteIndex = $state<number | null>(null);
	let hoveredByteInfo = $state<ByteInfo | null>(null);
	let tooltipPosition = $state({ x: 0, y: 0 });

	// 設定
	let bytesPerLine = $state(16);
	let maxBytes = $state(1024 * 1024); // 最大1MB表示

	// 制御文字のマッピング
	const controlChars: { [key: number]: string } = {
		0x00: 'NULL',
		0x01: 'SOH (Start of Heading)',
		0x02: 'STX (Start of Text)',
		0x03: 'ETX (End of Text)',
		0x04: 'EOT (End of Transmission)',
		0x05: 'ENQ (Enquiry)',
		0x06: 'ACK (Acknowledge)',
		0x07: 'BEL (Bell)',
		0x08: 'BS (Backspace)',
		0x09: 'TAB',
		0x0a: 'LF (Line Feed / 改行)',
		0x0b: 'VT (Vertical Tab)',
		0x0c: 'FF (Form Feed)',
		0x0d: 'CR (Carriage Return / 復帰)',
		0x0e: 'SO (Shift Out)',
		0x0f: 'SI (Shift In)',
		0x10: 'DLE (Data Link Escape)',
		0x11: 'DC1',
		0x12: 'DC2',
		0x13: 'DC3',
		0x14: 'DC4',
		0x15: 'NAK (Negative Acknowledge)',
		0x16: 'SYN (Synchronous Idle)',
		0x17: 'ETB (End of Transmission Block)',
		0x18: 'CAN (Cancel)',
		0x19: 'EM (End of Medium)',
		0x1a: 'SUB (Substitute)',
		0x1b: 'ESC (Escape)',
		0x1c: 'FS (File Separator)',
		0x1d: 'GS (Group Separator)',
		0x1e: 'RS (Record Separator)',
		0x1f: 'US (Unit Separator)',
		0x20: 'SPACE',
		0x7f: 'DEL (Delete)'
	};

	function getByteDescription(byte: number): string {
		if (controlChars[byte]) {
			return controlChars[byte];
		}
		if (byte >= 32 && byte <= 126) {
			return `'${String.fromCharCode(byte)}'`;
		}
		return '非印字可能文字';
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length) {
			file = input.files[0];
			input.value = '';
			generateHexDump();
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		if (e.dataTransfer?.files?.length) {
			file = e.dataTransfer.files[0];
			generateHexDump();
		}
	}

	async function generateHexDump() {
		if (!file || isProcessing) return;

		try {
			isProcessing = true;
			hexDump = '';
			hexLines = [];

			// 必要な部分のみ読み込む（メモリ効率化）
			const displayBytes = Math.min(file.size, maxBytes);
			const blob = file.slice(0, displayBytes);
			const buffer = await blob.arrayBuffer();
			const bytes = new Uint8Array(buffer);

			let output = '';
			let offset = 0;
			const lines: HexLine[] = [];

			while (offset < displayBytes) {
				// オフセット（16進数、8桁、ゼロパディング）
				const offsetStr = offset.toString(16).padStart(8, '0');

				// 現在の行のバイト数
				const lineBytes = Math.min(bytesPerLine, displayBytes - offset);
				const lineData = bytes.slice(offset, offset + lineBytes);

				// 各バイトの情報を構築
				const byteInfos: ByteInfo[] = [];
				let hexPart = '';
				let asciiPart = '';

				for (let i = 0; i < lineData.length; i++) {
					const byte = lineData[i];
					const hex = byte.toString(16).padStart(2, '0');
					const ascii = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
					const description = getByteDescription(byte);

					byteInfos.push({
						offset: offset + i,
						value: byte,
						hex,
						ascii,
						description
					});

					if (i > 0 && i % 2 === 0) {
						hexPart += ' ';
					}
					hexPart += hex;
					asciiPart += ascii;
				}

				// 16進数パートをパディング（bytesPerLineに満たない場合）
				const hexCharsPerLine = bytesPerLine * 2 + Math.floor(bytesPerLine / 2) - 1;
				hexPart = hexPart.padEnd(hexCharsPerLine, ' ');

				lines.push({
					offset: offsetStr,
					bytes: byteInfos
				});

				output += `${offsetStr}: ${hexPart}  ${asciiPart}\n`;
				offset += lineBytes;
			}

			if (file.size > maxBytes) {
				output += `\n... (残り ${file.size - maxBytes} バイトは省略されました)`;
			}

			hexLines = lines;
			hexDump = output;
		} catch (e) {
			console.error('Hexダンプ生成エラー:', e);
			alert('Hexダンプの生成に失敗しました');
		} finally {
			isProcessing = false;
		}
	}

	async function copyToClipboard() {
		if (!hexDump) return;

		try {
			await navigator.clipboard.writeText(hexDump);
			copyFeedback = true;
			setTimeout(() => {
				copyFeedback = false;
			}, 1500);
		} catch (e) {
			console.error('コピーエラー:', e);
			alert('クリップボードへのコピーに失敗しました');
		}
	}

	function clear() {
		file = null;
		hexDump = '';
		hexLines = [];
		hoveredByteIndex = null;
		hoveredByteInfo = null;
	}

	function handleByteHover(byte: ByteInfo, event: MouseEvent) {
		hoveredByteIndex = byte.offset;
		hoveredByteInfo = byte;
		tooltipPosition = { x: event.clientX, y: event.clientY };
	}

	function handleByteLeave() {
		hoveredByteIndex = null;
		hoveredByteInfo = null;
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 設定 -->
	<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="bytes-per-line" class="block text-sm font-medium text-gray-700"
					>1行あたりのバイト数</label
				>
				<select
					id="bytes-per-line"
					bind:value={bytesPerLine}
					onchange={() => file && generateHexDump()}
					class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
				>
					<option value={8}>8バイト</option>
					<option value={16}>16バイト (デフォルト)</option>
					<option value={32}>32バイト</option>
				</select>
			</div>
			<div>
				<label for="max-bytes" class="block text-sm font-medium text-gray-700"
					>最大表示バイト数</label
				>
				<select
					id="max-bytes"
					bind:value={maxBytes}
					onchange={() => file && generateHexDump()}
					class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
				>
					<option value={1024}>1 KB</option>
					<option value={10240}>10 KB</option>
					<option value={102400}>100 KB</option>
					<option value={1048576}>1 MB (デフォルト)</option>
					<option value={10485760}>10 MB</option>
				</select>
			</div>
		</div>
	</div>

	<!-- ファイルアップロード -->
	<div
		role="button"
		tabindex="0"
		aria-label="ファイルをドラッグ&ドロップまたはクリックして選択"
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
		onclick={() => document.getElementById('hex-file-input')?.click()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				document.getElementById('hex-file-input')?.click();
			}
		}}
		class="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors {dragOver
			? 'border-blue-400 bg-blue-50'
			: 'border-gray-300 bg-gray-50'}"
	>
		<Icon icon="mdi:file-upload" class="mb-2 h-12 w-12 text-gray-400" />
		<p class="mb-2 text-gray-700">ファイルをドラッグ＆ドロップ</p>
		<p class="mb-3 text-xs text-gray-500">または、クリックしてファイルを選択</p>
		<input id="hex-file-input" type="file" onchange={onFileInput} class="hidden" />
	</div>

	{#if file}
		<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Icon icon="mdi:file-document" class="h-8 w-8 text-blue-500" />
					<div>
						<p class="font-medium text-gray-800">{file.name}</p>
						<p class="text-sm text-gray-500">{formatFileSize(file.size)}</p>
					</div>
				</div>
				<div class="flex gap-2">
					{#if hexLines.length > 0}
						<button
							onclick={copyToClipboard}
							class="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700"
						>
							{#if copyFeedback}
								<Icon icon="mdi:check" class="h-4 w-4" />
								<span>コピーしました</span>
							{:else}
								<Icon icon="mdi:content-copy" class="h-4 w-4" />
								<span>コピー</span>
							{/if}
						</button>
					{/if}
					<button onclick={clear} class="rounded bg-gray-500 px-3 py-1.5 text-sm text-white">
						クリア
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- 結果表示 -->
	{#if hexLines.length > 0}
		<div class="relative rounded-lg border border-gray-200 bg-white p-4">
			<h3 class="mb-3 font-bold text-gray-800">Hexダンプ（ホバーで詳細表示）</h3>
			<div class="overflow-x-auto font-mono text-sm text-gray-700">
				{#each hexLines as line (line.offset)}
					<div class="hex-line whitespace-pre">
						<!-- オフセット -->
						<span class="text-gray-500">{line.offset}:</span>
						<span> </span>

						<!-- 16進数表示 -->
						{#each line.bytes as byte, i (byte.offset)}
							{#if i > 0 && i % 2 === 0}<span> </span>{/if}
							<span
								class="hex-byte cursor-pointer transition-colors {hoveredByteIndex === byte.offset
									? 'bg-yellow-200'
									: 'hover:bg-blue-100'}"
								onmouseenter={(e) => handleByteHover(byte, e)}
								onmouseleave={handleByteLeave}
							>
								{byte.hex}
							</span>
						{/each}

						<!-- パディング -->
						{#if line.bytes.length < bytesPerLine}
							{@const missingBytes = bytesPerLine - line.bytes.length}
							{@const paddingChars = missingBytes * 2 + Math.floor(missingBytes / 2)}
							<span>{' '.repeat(paddingChars)}</span>
						{/if}

						<span> </span>

						<!-- ASCII表示 -->
						{#each line.bytes as byte (byte.offset)}
							<span
								class="ascii-byte cursor-pointer transition-colors {hoveredByteIndex === byte.offset
									? 'bg-yellow-200'
									: 'hover:bg-blue-100'}"
								onmouseenter={(e) => handleByteHover(byte, e)}
								onmouseleave={handleByteLeave}
							>
								{byte.ascii}
							</span>
						{/each}
					</div>
				{/each}
				{#if file && file.size > maxBytes}
					<div class="mt-2 text-gray-500">
						... (残り {file.size - maxBytes} バイトは省略されました)
					</div>
				{/if}
			</div>

			<!-- カスタムツールチップ -->
			{#if hoveredByteInfo}
				<div
					class="pointer-events-none fixed z-50 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-lg"
					style="left: {tooltipPosition.x + 10}px; top: {tooltipPosition.y + 10}px;"
				>
					<div class="space-y-1">
						<div class="font-bold text-gray-800">
							オフセット: 0x{hoveredByteInfo.offset.toString(16).padStart(8, '0')} ({hoveredByteInfo.offset})
						</div>
						<div class="text-gray-700">
							16進数: <span class="font-mono font-semibold">0x{hoveredByteInfo.hex}</span>
						</div>
						<div class="text-gray-700">10進数: {hoveredByteInfo.value}</div>
						<div class="text-gray-700">
							2進数: {hoveredByteInfo.value.toString(2).padStart(8, '0')}
						</div>
						<div class="border-t border-gray-200 pt-1 text-gray-800">
							{hoveredByteInfo.description}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if isProcessing}
		<div class="flex items-center justify-center py-8" role="status" aria-live="polite">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
			></div>
			<p class="ml-3 text-gray-600">処理中...</p>
		</div>
	{/if}
</div>
