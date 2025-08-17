<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '@iconify/svelte';
	import type { ExecutionState, Breakpoint } from '$lib/assembly/controller';

	export let executionState: ExecutionState;
	export let breakpoints: Breakpoint[] = [];
	export let executionSpeed: number = 100; // ms per step

	const dispatch = createEventDispatcher();

	// 制御ボタンのハンドラ
	function step() {
		dispatch('step');
	}

	function run() {
		if (executionState.isRunning) {
			dispatch('pause');
		} else {
			dispatch('run');
		}
	}

	function reset() {
		dispatch('reset');
	}

	function parseCode() {
		dispatch('parse');
	}

	// ブレークポイント管理
	let newBreakpointLine = '';

	function addBreakpoint() {
		const line = parseInt(newBreakpointLine);
		if (!isNaN(line) && line >= 0) {
			dispatch('addBreakpoint', { line });
			newBreakpointLine = '';
		}
	}

	function removeBreakpoint(line: number) {
		dispatch('removeBreakpoint', { line });
	}

	function clearAllBreakpoints() {
		dispatch('clearBreakpoints');
	}

	function exportLog() {
		dispatch('export');
	}

	// プログレスバーの計算
	$: progress =
		executionState.totalInstructions > 0
			? (executionState.executedInstructions / executionState.totalInstructions) * 100
			: 0;

	$: canStep =
		!executionState.isRunning && executionState.currentPC < executionState.totalInstructions;
	$: canRun = executionState.totalInstructions > 0;
</script>

<div class="control-panel space-y-4">
	<!-- メイン制御ボタン -->
	<div class="main-controls">
		<h2 class="mb-3 text-lg font-semibold">実行制御</h2>

		<div class="space-y-2">
			<button
				class="flex w-full items-center justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!canStep}
				on:click={step}
			>
				<Icon icon="mdi:step-forward" class="mr-2" />
				ステップ実行
			</button>

			<button
				class="flex w-full items-center justify-center rounded px-4 py-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 {executionState.isRunning
					? 'bg-orange-600 hover:bg-orange-700'
					: 'bg-green-600 hover:bg-green-700'}"
				disabled={!canRun}
				on:click={run}
			>
				<Icon icon={executionState.isRunning ? 'mdi:pause' : 'mdi:play'} class="mr-2" />
				{executionState.isRunning ? '一時停止' : '連続実行'}
			</button>

			<button
				class="flex w-full items-center justify-center rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
				on:click={reset}
			>
				<Icon icon="mdi:restart" class="mr-2" />
				リセット
			</button>
		</div>
	</div>

	<!-- 実行状態 -->
	<div class="execution-status rounded-lg bg-gray-50 p-3">
		<h3 class="mb-2 text-sm font-medium">実行状態</h3>
		<div class="space-y-1 text-sm">
			<div class="flex justify-between">
				<span>現在行:</span>
				<span class="font-mono">{executionState.currentPC}</span>
			</div>
			<div class="flex justify-between">
				<span>実行済み:</span>
				<span class="font-mono"
					>{executionState.executedInstructions} / {executionState.totalInstructions}</span
				>
			</div>
			<div class="flex justify-between">
				<span>状態:</span>
				<span
					class="font-semibold {executionState.isRunning
						? 'text-green-600'
						: executionState.isPaused
							? 'text-orange-600'
							: 'text-gray-600'}"
				>
					{executionState.isRunning ? '実行中' : executionState.isPaused ? '一時停止' : '停止中'}
				</span>
			</div>
			{#if executionState.executionTime > 0}
				<div class="flex justify-between">
					<span>実行時間:</span>
					<span class="font-mono">{executionState.executionTime}ms</span>
				</div>
			{/if}
		</div>

		<!-- プログレスバー -->
		{#if executionState.totalInstructions > 0}
			<div class="mt-2">
				<div class="h-2 w-full rounded-full bg-gray-200">
					<div
						class="h-2 rounded-full bg-blue-600 transition-all duration-300"
						style="width: {progress}%"
					></div>
				</div>
				<div class="mt-1 text-center text-xs text-gray-500">
					{progress.toFixed(1)}% 完了
				</div>
			</div>
		{/if}
	</div>

	<!-- 実行速度制御 -->
	{#if executionState.isRunning}
		<div class="speed-control rounded-lg bg-gray-50 p-3">
			<h3 class="mb-2 text-sm font-medium">実行速度</h3>
			<div class="flex items-center space-x-2">
				<label for="speed" class="text-sm">遅延:</label>
				<input
					type="range"
					id="speed"
					min="10"
					max="1000"
					step="10"
					bind:value={executionSpeed}
					class="flex-1"
				/>
				<span class="w-16 font-mono text-sm">{executionSpeed}ms</span>
			</div>
		</div>
	{/if}

	<!-- ブレークポイント管理 -->
	<div class="breakpoint-controls rounded-lg bg-gray-50 p-3">
		<h3 class="mb-2 text-sm font-medium">ブレークポイント</h3>

		<!-- 追加フォーム -->
		<div class="mb-2 flex space-x-1">
			<input
				type="number"
				placeholder="行番号"
				bind:value={newBreakpointLine}
				class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
				min="0"
			/>
			<button
				class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
				on:click={addBreakpoint}
			>
				追加
			</button>
		</div>

		<!-- ブレークポイント一覧 -->
		{#if breakpoints.length > 0}
			<div class="max-h-32 space-y-1 overflow-y-auto">
				{#each breakpoints as bp}
					<div class="flex items-center justify-between rounded bg-white px-2 py-1 text-sm">
						<span class="font-mono">行 {bp.line}</span>
						<button
							class="text-red-600 hover:text-red-800"
							on:click={() => removeBreakpoint(bp.line)}
						>
							<Icon icon="mdi:close" class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>

			<button
				class="mt-2 w-full text-sm text-red-600 hover:text-red-800"
				on:click={clearAllBreakpoints}
			>
				全て削除
			</button>
		{:else}
			<div class="py-2 text-center text-sm text-gray-500">ブレークポイントが設定されていません</div>
		{/if}
	</div>

	<!-- エクスポート -->
	<div class="export-controls">
		<button
			class="flex w-full items-center justify-center rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
			on:click={exportLog}
		>
			<Icon icon="mdi:download" class="mr-2" />
			実行ログを出力
		</button>
	</div>

	<!-- キーボードショートカット -->
	<div class="keyboard-shortcuts border-t pt-2 text-xs text-gray-500">
		<div class="mb-1 font-medium">キーボードショートカット:</div>
		<div>Ctrl+Enter: ステップ実行</div>
		<div>Ctrl+R: 実行/一時停止</div>
		<div>Ctrl+Escape: 一時停止</div>
		<div>Ctrl+Backspace: リセット</div>
	</div>
</div>

<style>
	.control-panel {
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		padding: 1rem;
		background-color: white;
		max-height: 600px;
		overflow-y: auto;
	}
</style>
