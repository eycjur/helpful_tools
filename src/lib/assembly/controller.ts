// 実行制御クラス - プログラムの実行管理

import type { AssemblyLine, ParsedAssembly } from './parser';
import { AssemblyParser } from './parser';
import { CPUSimulator } from './cpu';
import { InstructionExecutor, type ExecutionResult } from './executor';
import { SystemCallSimulator } from './syscalls';

export interface Breakpoint {
	address: string;
	line: number;
	enabled: boolean;
	condition?: string;
}

export interface ExecutionTrace {
	step: number;
	pc: number;
	instruction: AssemblyLine;
	registersChanged: string[];
	memoryChanged: Array<{ address: bigint; value: number }>;
	timestamp: number;
}

export interface ExecutionState {
	isRunning: boolean;
	isPaused: boolean;
	currentPC: number;
	totalInstructions: number;
	executedInstructions: number;
	startTime?: number;
	executionTime: number;
}

export class ExecutionController {
	private cpu: CPUSimulator;
	private executor: InstructionExecutor;
	private syscallSim: SystemCallSimulator;
	private instructions: AssemblyLine[] = [];
	private currentPC: number = 0;
	private breakpoints: Map<number, Breakpoint> = new Map();
	private executionTrace: ExecutionTrace[] = [];
	private state: ExecutionState;
	private stepCount: number = 0;

	constructor() {
		this.cpu = new CPUSimulator();
		this.executor = new InstructionExecutor(this.cpu);
		this.syscallSim = new SystemCallSimulator();

		// CPUにシステムコールシミュレータを設定
		this.cpu.setSyscallSimulator(this.syscallSim);

		this.state = {
			isRunning: false,
			isPaused: false,
			currentPC: 0,
			totalInstructions: 0,
			executedInstructions: 0,
			executionTime: 0
		};
	}

	// === プログラム読み込み ===

	loadProgram(assemblyCode: string): { success: boolean; error?: string } {
		try {
			const parseResult = AssemblyParser.parse(assemblyCode);

			if (!parseResult.success || !parseResult.assembly) {
				return {
					success: false,
					error: parseResult.errors.map((e) => e.message).join('; ')
				};
			}

			this.instructions = parseResult.assembly.lines;
			this.executor.setInstructions(this.instructions);

			this.state.totalInstructions = this.instructions.length;
			this.reset();

			// サンプルデータを初期化（printf/scanf用の文字列など）
			this.syscallSim.initializeSampleData(this.cpu.getState().memory);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Program load failed'
			};
		}
	}

	// === 実行制御 ===

	step(): ExecutionResult {
		if (this.currentPC >= this.instructions.length) {
			// プログラム終了は成功として扱う
			this.state.isRunning = false;
			this.state.isPaused = false;
			return {
				success: true,
				error: 'Program execution completed',
				registersChanged: [],
				memoryChanged: [],
				flagsChanged: [],
				programTerminated: true
			};
		}

		// ブレークポイントをチェック
		if (this.breakpoints.has(this.currentPC) && this.breakpoints.get(this.currentPC)?.enabled) {
			this.state.isPaused = true;
			this.state.isRunning = false; // 連続実行を停止
			return {
				success: true,
				error: `Breakpoint hit at line ${this.currentPC}`,
				registersChanged: [],
				memoryChanged: [],
				flagsChanged: []
			};
		}

		const instruction = this.instructions[this.currentPC];

		// CPUのPCを同期
		this.cpu.setPC(this.currentPC);

		// 命令実行
		const result = this.executor.executeInstruction(instruction);

		if (result.success) {
			// 実行履歴に記録
			this.addTrace(instruction, result);

			// プログラム終了チェック
			if (result.programTerminated) {
				// プログラム終了を明示的に処理
				this.currentPC = this.instructions.length; // PCを末尾に設定してループを終了
				this.state.isRunning = false;
				this.state.isPaused = false;
			} else {
				// PCの更新
				if (result.jumped && result.jumpTarget !== undefined) {
					this.currentPC = result.jumpTarget;
				} else {
					this.currentPC++;
				}
			}

			this.state.currentPC = this.currentPC;
			this.state.executedInstructions++;
			this.stepCount++;
		}

		return result;
	}

	run(): void {
		if (this.state.isRunning) {
			this.pause();
			return;
		}

		this.state.isRunning = true;
		this.state.isPaused = false;
		this.state.startTime = Date.now();

		// 非同期実行
		this.runLoop();
	}

	private async runLoop(): Promise<void> {
		const maxStepsPerBatch = 100; // バッチサイズ
		const batchDelay = 10; // バッチ間の遅延（ms）

		while (this.state.isRunning && this.currentPC < this.instructions.length) {
			// バッチ実行
			for (
				let i = 0;
				i < maxStepsPerBatch && this.state.isRunning && this.currentPC < this.instructions.length;
				i++
			) {
				const result = this.step();

				// 実行エラー（真のエラー）のみ停止
				if (!result.success) {
					console.error('Execution error at PC', this.currentPC, ':', result.error);
					console.error('Instruction:', this.instructions[this.currentPC]);
					this.state.isRunning = false;
					break;
				}

				// プログラム終了チェック
				if (result.programTerminated) {
					this.state.isRunning = false;
					break;
				}

				// ブレークポイントまたは一時停止で停止
				if (this.state.isPaused) {
					break;
				}

				// 実行状態が変更された場合の停止
				if (!this.state.isRunning) {
					break;
				}
			}

			// UIの応答性を保つため少し待機
			if (this.state.isRunning && this.currentPC < this.instructions.length) {
				await new Promise((resolve) => setTimeout(resolve, batchDelay));
			}
		}

		// 全命令実行完了時は実行状態を停止に設定
		if (this.currentPC >= this.instructions.length) {
			this.state.isRunning = false;
			this.state.isPaused = false;
		}

		this.updateExecutionTime();
	}

	pause(): void {
		this.state.isRunning = false;
		this.state.isPaused = true;
		this.updateExecutionTime();
	}

	reset(): void {
		this.state.isRunning = false;
		this.state.isPaused = false;
		this.currentPC = 0;
		this.state.currentPC = 0;
		this.state.executedInstructions = 0;
		this.state.executionTime = 0;
		this.stepCount = 0;

		// CPU状態をリセット
		this.cpu.reset();

		// 実行履歴をクリア
		this.executionTrace = [];
	}

	private updateExecutionTime(): void {
		if (this.state.startTime) {
			this.state.executionTime = Date.now() - this.state.startTime;
		}
	}

	// === ブレークポイント管理 ===

	addBreakpoint(line: number): void {
		if (line >= 0 && line < this.instructions.length) {
			const instruction = this.instructions[line];
			this.breakpoints.set(line, {
				address: instruction.address,
				line,
				enabled: true
			});
		}
	}

	removeBreakpoint(line: number): void {
		this.breakpoints.delete(line);
	}

	toggleBreakpoint(line: number): void {
		const bp = this.breakpoints.get(line);
		if (bp) {
			bp.enabled = !bp.enabled;
		} else {
			this.addBreakpoint(line);
		}
	}

	getBreakpoints(): Breakpoint[] {
		return Array.from(this.breakpoints.values());
	}

	clearAllBreakpoints(): void {
		this.breakpoints.clear();
	}

	// === 実行履歴 ===

	private addTrace(instruction: AssemblyLine, result: ExecutionResult): void {
		const trace: ExecutionTrace = {
			step: this.stepCount,
			pc: this.currentPC,
			instruction,
			registersChanged: result.registersChanged,
			memoryChanged: result.memoryChanged,
			timestamp: Date.now()
		};

		this.executionTrace.push(trace);

		// 履歴サイズ制限
		if (this.executionTrace.length > 1000) {
			this.executionTrace.shift();
		}
	}

	getExecutionTrace(): ExecutionTrace[] {
		return [...this.executionTrace];
	}

	clearExecutionTrace(): void {
		this.executionTrace = [];
	}

	// === 状態取得 ===

	getState(): ExecutionState {
		return { ...this.state };
	}

	getCurrentInstruction(): AssemblyLine | null {
		if (this.currentPC >= 0 && this.currentPC < this.instructions.length) {
			return this.instructions[this.currentPC];
		}
		return null;
	}

	getInstructions(): AssemblyLine[] {
		return [...this.instructions];
	}

	getCurrentPC(): number {
		return this.currentPC;
	}

	getCPU(): CPUSimulator {
		return this.cpu;
	}

	getSystemCallSimulator(): SystemCallSimulator {
		return this.syscallSim;
	}

	// ユーザー入力を処理
	processUserInput(userInput: string): ExecutionResult {
		const result = this.executor.processUserInput(userInput);
		// ユーザー入力処理後は状態更新は呼び出し元が行う
		return result;
	}

	// === デバッグ情報 ===

	getDebugInfo() {
		return {
			currentPC: this.currentPC,
			instruction: this.getCurrentInstruction(),
			registers: this.cpu.getState().registers,
			flags: this.cpu.getState().flags,
			stackView: this.cpu.getStackView(16),
			executionState: this.state,
			breakpoints: this.getBreakpoints(),
			recentTrace: this.executionTrace.slice(-10)
		};
	}

	// === エクスポート機能 ===

	exportExecutionLog(): string {
		const data = {
			instructions: this.instructions,
			executionTrace: this.executionTrace,
			finalState: {
				registers: this.cpu.getState().registers,
				flags: this.cpu.getState().flags,
				memory: Object.fromEntries(this.cpu.getState().memory)
			},
			statistics: {
				totalInstructions: this.state.totalInstructions,
				executedInstructions: this.state.executedInstructions,
				executionTime: this.state.executionTime,
				totalSteps: this.stepCount
			}
		};

		return JSON.stringify(
			data,
			(key, value) => {
				// BigIntを文字列として出力
				return typeof value === 'bigint' ? value.toString() : value;
			},
			2
		);
	}
}
