<script lang="ts">
	export let memory: Map<bigint, number>;
	export let stackPointer: bigint;
	export let basePointer: bigint;
	export let changedAddresses: Set<bigint> = new Set();

	let viewMode: 'stack' | 'memory' = 'stack';
	let memoryStartAddress = '0x7fff0000';
	let memorySize = 64;

	function formatAddress(address: bigint): string {
		return '0x' + address.toString(16).padStart(8, '0').toUpperCase();
	}

	function formatByte(value: number): string {
		return value.toString(16).padStart(2, '0').toUpperCase();
	}

	function toAscii(value: number): string {
		if (value >= 32 && value <= 126) {
			return String.fromCharCode(value);
		}
		return '.';
	}

	function isChanged(address: bigint): boolean {
		return changedAddresses.has(address);
	}

	function isStackPointer(address: bigint): boolean {
		return address === stackPointer;
	}

	function isBasePointer(address: bigint): boolean {
		return address === basePointer;
	}

	// スタックビューの生成（降順）
	$: stackView = (() => {
		const view: Array<{ address: bigint; value: number; isPointer: string }> = [];
		const startAddr = stackPointer;

		for (let i = -16; i <= 16; i++) {
			const addr = startAddr + BigInt(i * 8);
			const bytes: number[] = [];

			for (let j = 0; j < 8; j++) {
				const byteAddr = addr + BigInt(j);
				bytes.push(memory.get(byteAddr) || 0);
			}

			// リトルエンディアンで8バイト値を構成
			let value = 0;
			for (let j = 7; j >= 0; j--) {
				value = value * 256 + bytes[j];
			}

			let pointerType = '';
			if (isStackPointer(addr)) pointerType = 'SP';
			else if (isBasePointer(addr)) pointerType = 'BP';

			view.push({
				address: addr,
				value,
				isPointer: pointerType
			});
		}

		return view.sort((a, b) => Number(b.address - a.address)); // 降順
	})();

	// メモリビューの生成
	$: memoryView = (() => {
		const view: Array<{ address: bigint; bytes: number[]; ascii: string }> = [];
		const startAddr = BigInt(memoryStartAddress);

		for (let i = 0; i < memorySize; i += 16) {
			const addr = startAddr + BigInt(i);
			const bytes: number[] = [];
			let ascii = '';

			for (let j = 0; j < 16; j++) {
				const byteAddr = addr + BigInt(j);
				const value = memory.get(byteAddr) || 0;
				bytes.push(value);
				ascii += toAscii(value);
			}

			view.push({ address: addr, bytes, ascii });
		}

		return view;
	})();
</script>

<div class="memory-panel space-y-4">
	<!-- ビューモード選択 -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">メモリ</h2>
		<div class="flex space-x-2">
			<button
				class="rounded px-2 py-1 text-xs {viewMode === 'stack'
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 text-gray-700'}"
				on:click={() => (viewMode = 'stack')}
			>
				スタック
			</button>
			<button
				class="rounded px-2 py-1 text-xs {viewMode === 'memory'
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 text-gray-700'}"
				on:click={() => (viewMode = 'memory')}
			>
				メモリ
			</button>
		</div>
	</div>

	{#if viewMode === 'stack'}
		<!-- スタックビュー -->
		<div class="stack-view">
			<h3 class="mb-2 text-sm font-medium text-gray-600">スタック領域</h3>
			<div class="mb-2 text-xs text-gray-500">
				SP: {formatAddress(stackPointer)} | BP: {formatAddress(basePointer)}
			</div>

			<div class="memory-content max-h-96 space-y-0.5 overflow-y-auto">
				{#each stackView as row}
					<div
						class="flex items-center space-x-2 font-mono text-xs {isStackPointer(row.address) ||
						isBasePointer(row.address)
							? 'border-l-2 border-blue-400 bg-blue-50'
							: ''} {isChanged(row.address) ? 'bg-yellow-50' : ''}"
					>
						<!-- ポインタ表示 -->
						<span
							class="w-6 text-right font-bold {row.isPointer === 'SP'
								? 'text-blue-600'
								: row.isPointer === 'BP'
									? 'text-green-600'
									: ''}"
						>
							{row.isPointer}
						</span>

						<!-- アドレス -->
						<span class="w-20 text-gray-500">
							{formatAddress(row.address)}
						</span>

						<!-- 値（8バイト） -->
						<span class="w-20 text-gray-700">
							{formatAddress(BigInt(row.value))}
						</span>

						<!-- ASCII表現 -->
						<span class="text-xs text-gray-400">
							{#each Array.from({ length: 8 }, (_, i) => memory.get(row.address + BigInt(i)) || 0) as byte}
								{toAscii(byte)}
							{/each}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- メモリビュー -->
		<div class="memory-view">
			<h3 class="mb-2 text-sm font-medium text-gray-600">メモリダンプ</h3>

			<!-- 表示設定 -->
			<div class="mb-2 flex items-center space-x-2">
				<label class="text-xs text-gray-600">開始アドレス:</label>
				<input
					bind:value={memoryStartAddress}
					class="w-24 rounded border border-gray-300 px-1 py-0.5 font-mono text-xs"
					placeholder="0x7fff0000"
				/>
				<label class="text-xs text-gray-600">サイズ:</label>
				<input
					bind:value={memorySize}
					type="number"
					min="16"
					max="512"
					step="16"
					class="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs"
				/>
			</div>

			<!-- ヘキサダンプ -->
			<div class="memory-content max-h-96 overflow-y-auto">
				<div class="font-mono text-xs">
					<!-- ヘッダー -->
					<div class="mb-1 flex border-b pb-1 text-gray-500">
						<span class="w-20">Address</span>
						<span class="ml-2 w-48">Hex Data</span>
						<span class="ml-2">ASCII</span>
					</div>

					<!-- データ行 -->
					{#each memoryView as row}
						<div class="flex space-x-2 {isChanged(row.address) ? 'bg-yellow-50' : ''}">
							<!-- アドレス -->
							<span class="w-20 text-gray-600">
								{formatAddress(row.address)}
							</span>

							<!-- 16進数データ -->
							<span class="flex w-48 space-x-1">
								{#each row.bytes as byte, i}
									<span
										class="w-6 text-center {isChanged(row.address + BigInt(i))
											? 'bg-yellow-200'
											: ''}"
									>
										{formatByte(byte)}
									</span>
								{/each}
							</span>

							<!-- ASCII -->
							<span class="ml-2 text-gray-400">
								{row.ascii}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- メモリ統計 -->
	<div class="memory-stats border-t pt-2 text-xs text-gray-500">
		<div>使用中のメモリアドレス: {memory.size} 個</div>
		<div>変更されたアドレス: {changedAddresses.size} 個</div>
		{#if memory.size > 0}
			<div>
				アドレス範囲: {formatAddress(BigInt(Math.min(...Array.from(memory.keys()).map(Number))))} -
				{formatAddress(BigInt(Math.max(...Array.from(memory.keys()).map(Number))))}
			</div>
		{/if}
	</div>
</div>

<style>
	.memory-panel {
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		padding: 1rem;
		background-color: white;
		max-height: 600px;
		overflow-y: auto;
	}

	.memory-content {
		background-color: #f9fafb;
		border-radius: 0.25rem;
		padding: 0.5rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	}
</style>
