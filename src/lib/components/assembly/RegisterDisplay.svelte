<script lang="ts">
	import type { RegisterSet, FlagsRegister } from '$lib/assembly/cpu';
	import { getRegisterFullDescription, type RegisterDoc } from '$lib/assembly/register-docs';

	export let registers: RegisterSet;
	export let flags: FlagsRegister;
	export let changedRegisters: Set<string> = new Set();

	let displayFormat: 'hex' | 'dec' = 'hex';

	// ツールチップ状態管理
	let tooltip = {
		visible: false,
		x: 0,
		y: 0,
		content: null as RegisterDoc | null
	};

	function formatValue(value: bigint, format: 'hex' | 'dec' = displayFormat): string {
		if (format === 'hex') {
			return '0x' + value.toString(16).padStart(16, '0').toUpperCase();
		} else {
			return value.toString(10);
		}
	}

	function isChanged(register: string): boolean {
		return changedRegisters.has(register) || changedRegisters.has(register.toLowerCase());
	}

	// ツールチップ表示
	function showTooltip(event: MouseEvent, registerName: string) {
		const doc = getRegisterFullDescription(`%${registerName.toLowerCase()}`);
		if (!doc) return;

		tooltip = {
			visible: true,
			x: event.clientX + 10,
			y: event.clientY + 10,
			content: doc
		};
	}

	// ツールチップ非表示
	function hideTooltip() {
		tooltip.visible = false;
	}

	// フラグツールチップ用の情報
	const flagDocs = {
		ZF: {
			name: 'ZF (Zero Flag)',
			description: 'ゼロフラグ - 演算結果が0の時に1になる',
			usage: '条件分岐 (JE/JZ, JNE/JNZ) で使用'
		},
		SF: {
			name: 'SF (Sign Flag)',
			description: 'サインフラグ - 演算結果が負の時に1になる',
			usage: '条件分岐 (JS, JNS) で使用'
		},
		CF: {
			name: 'CF (Carry Flag)',
			description: 'キャリーフラグ - 演算でオーバーフロー時に1になる',
			usage: '条件分岐 (JC, JNC) や多倍長演算で使用'
		},
		OF: {
			name: 'OF (Overflow Flag)',
			description: 'オーバーフローフラグ - 符号付き演算でオーバーフロー時に1になる',
			usage: '条件分岐 (JO, JNO) で使用'
		}
	};

	// フラグツールチップ表示
	function showFlagTooltip(event: MouseEvent, flagName: keyof typeof flagDocs) {
		const doc = flagDocs[flagName];
		tooltip = {
			visible: true,
			x: event.clientX + 10,
			y: event.clientY + 10,
			content: {
				name: doc.name,
				fullName: doc.name,
				description: doc.description,
				size: '1ビット',
				usage: doc.usage,
				examples: []
			}
		};
	}

	// レジスタのグループ化
	$: generalRegisters = [
		{ name: 'RAX', value: registers.rax },
		{ name: 'RBX', value: registers.rbx },
		{ name: 'RCX', value: registers.rcx },
		{ name: 'RDX', value: registers.rdx }
	];

	$: pointerRegisters = [
		{ name: 'RSI', value: registers.rsi },
		{ name: 'RDI', value: registers.rdi },
		{ name: 'RSP', value: registers.rsp },
		{ name: 'RBP', value: registers.rbp }
	];

	$: extendedRegisters = [
		{ name: 'R8', value: registers.r8 },
		{ name: 'R9', value: registers.r9 },
		{ name: 'R10', value: registers.r10 },
		{ name: 'R11', value: registers.r11 },
		{ name: 'R12', value: registers.r12 },
		{ name: 'R13', value: registers.r13 },
		{ name: 'R14', value: registers.r14 },
		{ name: 'R15', value: registers.r15 }
	];
</script>

<div class="register-panel space-y-4">
	<!-- 表示形式切り替え -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">レジスタ</h2>
		<div class="flex space-x-2">
			<button
				class="rounded px-2 py-1 text-xs {displayFormat === 'hex'
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 text-gray-700'}"
				on:click={() => (displayFormat = 'hex')}
			>
				16進数
			</button>
			<button
				class="rounded px-2 py-1 text-xs {displayFormat === 'dec'
					? 'bg-blue-600 text-white'
					: 'bg-gray-200 text-gray-700'}"
				on:click={() => (displayFormat = 'dec')}
			>
				10進数
			</button>
		</div>
	</div>

	<!-- 汎用レジスタ -->
	<div class="register-group">
		<h3 class="mb-2 text-sm font-medium text-gray-600">汎用レジスタ</h3>
		<div class="space-y-1">
			{#each generalRegisters as reg}
				<div
					class="flex justify-between font-mono text-sm {isChanged(reg.name)
						? 'rounded bg-yellow-100 px-1'
						: ''}"
				>
					<span
						class="cursor-help font-semibold hover:text-blue-600"
						on:mouseenter={(e) => showTooltip(e, reg.name)}
						on:mouseleave={hideTooltip}
						role="button"
						tabindex="0"
						title="クリックして詳細を表示">{reg.name}:</span
					>
					<span class="text-gray-700">{formatValue(reg.value)}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- ポインタレジスタ -->
	<div class="register-group">
		<h3 class="mb-2 text-sm font-medium text-gray-600">ポインタレジスタ</h3>
		<div class="space-y-1">
			{#each pointerRegisters as reg}
				<div
					class="flex justify-between font-mono text-sm {isChanged(reg.name)
						? 'rounded bg-yellow-100 px-1'
						: ''}"
				>
					<span
						class="cursor-help font-semibold hover:text-blue-600"
						on:mouseenter={(e) => showTooltip(e, reg.name)}
						on:mouseleave={hideTooltip}
						role="button"
						tabindex="0"
						title="クリックして詳細を表示">{reg.name}:</span
					>
					<span class="text-gray-700">{formatValue(reg.value)}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- 拡張レジスタ -->
	<div class="register-group">
		<h3 class="mb-2 text-sm font-medium text-gray-600">拡張レジスタ (R8-R15)</h3>
		<div class="grid grid-cols-2 gap-x-4 gap-y-1">
			{#each extendedRegisters as reg}
				<div
					class="flex justify-between font-mono text-sm {isChanged(reg.name)
						? 'rounded bg-yellow-100 px-1'
						: ''}"
				>
					<span
						class="cursor-help font-semibold hover:text-blue-600"
						on:mouseenter={(e) => showTooltip(e, reg.name)}
						on:mouseleave={hideTooltip}
						role="button"
						tabindex="0"
						title="クリックして詳細を表示">{reg.name}:</span
					>
					<span class="text-xs text-gray-700">{formatValue(reg.value).slice(0, 12)}...</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- フラグレジスタ -->
	<div class="register-group">
		<h3 class="mb-2 text-sm font-medium text-gray-600">フラグ</h3>
		<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
			<div class="flex justify-between">
				<span
					class="cursor-help font-semibold hover:text-blue-600"
					on:mouseenter={(e) => showFlagTooltip(e, 'ZF')}
					on:mouseleave={hideTooltip}
					role="button"
					tabindex="0"
					title="クリックして詳細を表示">ZF:</span
				>
				<span class="font-mono {flags.zf ? 'font-bold text-green-600' : 'text-red-600'}"
					>{flags.zf ? '1' : '0'}</span
				>
			</div>
			<div class="flex justify-between">
				<span
					class="cursor-help font-semibold hover:text-blue-600"
					on:mouseenter={(e) => showFlagTooltip(e, 'SF')}
					on:mouseleave={hideTooltip}
					role="button"
					tabindex="0"
					title="クリックして詳細を表示">SF:</span
				>
				<span class="font-mono {flags.sf ? 'font-bold text-green-600' : 'text-red-600'}"
					>{flags.sf ? '1' : '0'}</span
				>
			</div>
			<div class="flex justify-between">
				<span
					class="cursor-help font-semibold hover:text-blue-600"
					on:mouseenter={(e) => showFlagTooltip(e, 'CF')}
					on:mouseleave={hideTooltip}
					role="button"
					tabindex="0"
					title="クリックして詳細を表示">CF:</span
				>
				<span class="font-mono {flags.cf ? 'font-bold text-green-600' : 'text-red-600'}"
					>{flags.cf ? '1' : '0'}</span
				>
			</div>
			<div class="flex justify-between">
				<span
					class="cursor-help font-semibold hover:text-blue-600"
					on:mouseenter={(e) => showFlagTooltip(e, 'OF')}
					on:mouseleave={hideTooltip}
					role="button"
					tabindex="0"
					title="クリックして詳細を表示">OF:</span
				>
				<span class="font-mono {flags.of ? 'font-bold text-green-600' : 'text-red-600'}"
					>{flags.of ? '1' : '0'}</span
				>
			</div>
		</div>

		<!-- フラグの説明 -->
		<div class="mt-2 text-xs text-gray-500">
			<div>ZF: ゼロフラグ | SF: サインフラグ</div>
			<div>CF: キャリーフラグ | OF: オーバーフローフラグ</div>
		</div>
	</div>
</div>

<!-- レジスタツールチップ -->
{#if tooltip.visible && tooltip.content}
	<div
		class="pointer-events-none fixed z-50 max-w-md rounded-lg bg-gray-900 p-4 text-sm text-white shadow-xl"
		style="left: {tooltip.x}px; top: {tooltip.y}px;"
	>
		<div class="mb-2 border-b border-gray-700 pb-2">
			<div class="text-lg font-bold text-blue-300">{tooltip.content.name}</div>
			<div class="text-gray-300">{tooltip.content.description}</div>
		</div>

		<div class="space-y-2">
			<div>
				<div class="font-semibold text-yellow-300">サイズ:</div>
				<div class="text-gray-200">{tooltip.content.size}</div>
			</div>

			<div>
				<div class="font-semibold text-yellow-300">用途:</div>
				<div class="text-gray-200">{tooltip.content.usage}</div>
			</div>

			{#if tooltip.content.aliases && tooltip.content.aliases.length > 0}
				<div>
					<div class="font-semibold text-yellow-300">関連レジスタ:</div>
					<div class="text-gray-200">{tooltip.content.aliases.join(', ')}</div>
				</div>
			{/if}

			{#if tooltip.content.examples && tooltip.content.examples.length > 0}
				<div>
					<div class="font-semibold text-yellow-300">例:</div>
					<div class="space-y-1">
						{#each tooltip.content.examples as example}
							<div class="rounded bg-gray-800 p-1 font-mono text-xs text-green-300">{example}</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if tooltip.content.notes}
				<div>
					<div class="font-semibold text-yellow-300">注意:</div>
					<div class="text-gray-300">{tooltip.content.notes}</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.register-panel {
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		padding: 1rem;
		background-color: white;
		max-height: 600px;
		overflow-y: auto;
	}

	.register-group {
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.register-group:last-child {
		border-bottom: none;
	}
</style>
