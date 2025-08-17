<script lang="ts">
	import { onMount } from 'svelte';
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	// コンポーネントインポート
	import CodeDisplay from '$lib/components/assembly/CodeDisplay.svelte';
	import ControlPanel from '$lib/components/assembly/ControlPanel.svelte';
	import RegisterDisplay from '$lib/components/assembly/RegisterDisplay.svelte';
	import MemoryDisplay from '$lib/components/assembly/MemoryDisplay.svelte';
	import InputOutput from '$lib/components/assembly/InputOutput.svelte';

	// コア機能インポート
	import { ExecutionController } from '$lib/assembly/controller';
	import type { ExecutionState, Breakpoint } from '$lib/assembly/controller';
	import type { AssemblyLine } from '$lib/assembly/parser';

	const tool = tools.find((t) => t.name === 'assembly-interpreter');

	// 実行制御
	let controller = new ExecutionController();
	let executionState: ExecutionState = controller.getState();
	let instructions: AssemblyLine[] = [];
	let breakpoints: Breakpoint[] = [];
	let breakpointSet = new Set<number>();

	// CPU状態
	let registers = controller.getCPU().getState().registers;
	let flags = controller.getCPU().getState().flags;
	let memory = controller.getCPU().getState().memory;
	let changedRegisters = new Set<string>();
	let changedMemory = new Set<bigint>();

	// UI状態
	let inputCode = '';
	let errorMessage = '';
	let executionSpeed = 100;

	// システムコール関連
	let systemCallOutput = '';
	let inputRequired = false;
	let inputPrompt = '';
	let inputOutputComponent: InputOutput;

	// 初期化
	onMount(() => {
		updateState();

		// キーボードショートカット
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	function updateState() {
		executionState = controller.getState();
		instructions = controller.getInstructions();
		breakpoints = controller.getBreakpoints();
		breakpointSet = new Set(breakpoints.map((bp) => bp.line));

		// CPU状態更新
		const cpuState = controller.getCPU().getState();
		registers = cpuState.registers;
		flags = cpuState.flags;
		memory = cpuState.memory;

		changedRegisters = controller.getCPU().getChangedRegisters();
		changedMemory = controller.getCPU().getChangedMemory();

		// システムコール状態更新
		const syscallSim = controller.getSystemCallSimulator();
		systemCallOutput = syscallSim.getOutput();
		const pendingInput = syscallSim.getPendingInput();
		inputRequired = !!pendingInput;
		inputPrompt = pendingInput?.prompt || '';
	}

	// イベントハンドラ
	function handleParse(event: CustomEvent) {
		const { code } = event.detail;
		const result = controller.loadProgram(code);

		if (!result.success) {
			errorMessage = result.error || '解析エラー';
		} else {
			errorMessage = '';
		}

		updateState();
	}

	function handleStep() {
		const result = controller.step();
		if (!result.success && result.error) {
			errorMessage = result.error;
		} else {
			errorMessage = '';
		}

		// システムコール出力を追加
		if (result.systemCallOutput) {
			const syscallSim = controller.getSystemCallSimulator();
			// 出力は既にシミュレータに蓄積されている
		}

		updateState();
	}

	function handleRun() {
		controller.run();
		updateState();

		// 非同期実行中の状態更新
		if (executionState.isRunning) {
			const interval = setInterval(() => {
				updateState();
				if (!controller.getState().isRunning) {
					clearInterval(interval);
				}
			}, 100);
		}
	}

	function handlePause() {
		controller.pause();
		updateState();
	}

	function handleReset() {
		controller.reset();
		updateState();
		errorMessage = '';
	}

	function handleAddBreakpoint(event: CustomEvent) {
		const { line } = event.detail;
		controller.addBreakpoint(line);
		updateState();
	}

	function handleRemoveBreakpoint(event: CustomEvent) {
		const { line } = event.detail;
		controller.removeBreakpoint(line);
		updateState();
	}

	function handleToggleBreakpoint(event: CustomEvent) {
		const { line } = event.detail;
		controller.toggleBreakpoint(line);
		updateState();
	}

	function handleClearBreakpoints() {
		controller.clearAllBreakpoints();
		updateState();
	}

	function handleExport() {
		const log = controller.exportExecutionLog();
		const blob = new Blob([log], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'assembly-execution-log.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleJumpTo(event: CustomEvent) {
		// 将来の拡張用
		console.log('Jump to line:', event.detail.line);
	}

	// システムコール関連のイベントハンドラ
	function handleUserInput(event: CustomEvent) {
		const { value } = event.detail;
		const result = controller.processUserInput(value);

		if (!result.success && result.error) {
			errorMessage = result.error;
		} else {
			errorMessage = '';
		}

		updateState();
	}

	function handleClearOutput() {
		const syscallSim = controller.getSystemCallSimulator();
		syscallSim.clearOutput();
		updateState();
	}

	// キーボードショートカット（Ctrlキーのみ）
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey && !event.metaKey) {
			switch (event.key) {
				case 'Enter':
					event.preventDefault();
					handleStep();
					break;
				case 'r':
					event.preventDefault();
					handleRun();
					break;
				case 'Escape':
					event.preventDefault();
					handlePause();
					break;
				case 'Backspace':
					event.preventDefault();
					handleReset();
					break;
			}
		}
	}
</script>

<div class="mx-auto max-w-7xl">
	<!-- ヘッダー -->
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-4 text-gray-600">
		{tool?.description}
	</div>

	<!-- エラーメッセージ表示 -->
	{#if errorMessage}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
			<div class="flex items-center">
				<Icon icon="mdi:alert-circle" class="mr-2 text-red-600" />
				<span class="text-sm text-red-800">{errorMessage}</span>
			</div>
		</div>
	{/if}

	<!-- メインレイアウト：4カラム（2x2グリッド） -->
	<div class="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-4">
		<!-- 左上: アセンブリコード入力・表示 -->
		<div class="xl:col-span-1">
			<CodeDisplay
				{instructions}
				currentPC={executionState?.currentPC || 0}
				breakpoints={breakpointSet}
				bind:inputCode
				on:parse={handleParse}
				on:toggleBreakpoint={handleToggleBreakpoint}
				on:jumpTo={handleJumpTo}
			/>
		</div>

		<!-- 右上: 実行制御パネル -->
		<div class="xl:col-span-1">
			<ControlPanel
				{executionState}
				{breakpoints}
				{executionSpeed}
				on:step={handleStep}
				on:run={handleRun}
				on:pause={handlePause}
				on:reset={handleReset}
				on:addBreakpoint={handleAddBreakpoint}
				on:removeBreakpoint={handleRemoveBreakpoint}
				on:clearBreakpoints={handleClearBreakpoints}
				on:export={handleExport}
			/>
		</div>

		<!-- 左下: レジスタ・メモリ表示 -->
		<div class="space-y-6 xl:col-span-1">
			<RegisterDisplay {registers} {flags} {changedRegisters} />

			<MemoryDisplay
				{memory}
				stackPointer={registers.rsp}
				basePointer={registers.rbp}
				changedAddresses={changedMemory}
			/>
		</div>

		<!-- 右下: プログラム入出力 -->
		<div class="xl:col-span-1">
			<InputOutput
				bind:this={inputOutputComponent}
				output={systemCallOutput}
				{inputRequired}
				{inputPrompt}
				on:input={handleUserInput}
				on:clearOutput={handleClearOutput}
			/>
		</div>
	</div>
</div>
