// 命令実行エンジン - x86-64命令の実行

import type { AssemblyLine } from './parser';
import { AssemblyParser } from './parser';
import type { CPUSimulator } from './cpu';
import { SystemCallSimulator } from './syscalls';

export interface ExecutionResult {
	success: boolean;
	error?: string;
	registersChanged: string[];
	memoryChanged: Array<{ address: bigint; value: number }>;
	flagsChanged: string[];
	pcChanged?: boolean;
	jumped?: boolean;
	jumpTarget?: number;
	programTerminated?: boolean;
	systemCallOutput?: string;
	systemCallInputRequired?: boolean;
	systemCallInputPrompt?: string;
}

export interface OperandValue {
	type: 'register' | 'immediate' | 'memory' | 'label';
	value: bigint;
	address?: bigint; // メモリオペランドの場合
	register?: string; // レジスタオペランドの場合
}

interface InstructionHandler {
	operandCount: number;
	needsComment?: boolean;
	execute: (operands: string[], comment?: string) => void;
}

export class InstructionExecutor {
	private cpu: CPUSimulator;
	private labelMap: Map<string, number> = new Map();
	private addressToIndex: Map<string, number> = new Map();
	private jumped: boolean = false;
	private jumpTarget: number = -1;
	private lastSystemCallResult: any = null;
	private instructionMap!: Map<string, InstructionHandler>;

	constructor(cpu: CPUSimulator) {
		this.cpu = cpu;
		this.initializeInstructionMap();
	}

	private initializeInstructionMap(): void {
		this.instructionMap = new Map([
			// データ移動命令
			['movq', { operandCount: 2, execute: (op) => this.executeMovq(op[0], op[1]) }],
			['movl', { operandCount: 2, execute: (op) => this.executeMovl(op[0], op[1]) }],
			['leaq', { operandCount: 2, execute: (op) => this.executeLeaq(op[0], op[1]) }],

			// スタック操作命令
			['pushq', { operandCount: 1, execute: (op) => this.executePushq(op[0]) }],
			['popq', { operandCount: 1, execute: (op) => this.executePopq(op[0]) }],
			['subq', { operandCount: 2, execute: (op) => this.executeSubq(op[0], op[1]) }],
			['addl', { operandCount: 2, execute: (op) => this.executeAddl(op[0], op[1]) }],

			// 比較・論理命令
			['cmpb', { operandCount: 2, execute: (op) => this.executeCmpb(op[0], op[1]) }],
			['movzbl', { operandCount: 2, execute: (op) => this.executeMovzbl(op[0], op[1]) }],
			['cltq', { operandCount: 0, execute: () => this.executeCltq() }],

			// 分岐命令（コメント情報も参照）
			[
				'jmp',
				{
					operandCount: 1,
					needsComment: true,
					execute: (op, comment) => this.executeJmp(this.resolveTargetWithComment(op[0], comment))
				}
			],
			[
				'je',
				{
					operandCount: 1,
					needsComment: true,
					execute: (op, comment) => this.executeJe(this.resolveTargetWithComment(op[0], comment))
				}
			],
			[
				'jne',
				{
					operandCount: 1,
					needsComment: true,
					execute: (op, comment) => this.executeJne(this.resolveTargetWithComment(op[0], comment))
				}
			],

			// 関数呼び出し
			[
				'callq',
				{
					operandCount: 1,
					needsComment: true,
					execute: (op, comment) => this.executeCallq(this.resolveTargetWithComment(op[0], comment))
				}
			],
			['retq', { operandCount: 0, execute: () => this.executeRetq() }],

			// その他
			[
				'nop',
				{
					operandCount: 0,
					execute: () => {
						/* 何もしない */
					}
				}
			],
			['leave', { operandCount: 0, execute: () => this.executeLeave() }]
		]);
	}

	// ラベルマップを設定（実行前に呼び出す）
	setInstructions(instructions: AssemblyLine[]): void {
		this.labelMap.clear();
		this.addressToIndex.clear();

		console.log(`Setting up ${instructions.length} instructions`);

		for (let i = 0; i < instructions.length; i++) {
			const instruction = instructions[i];
			const address = instruction.address;

			// アドレスをインデックスにマップ
			this.addressToIndex.set(address, i);
			console.log(`Mapped address ${address} -> index ${i} (${instruction.mnemonic})`);

			// コメントからラベルを抽出（例：# 0x1c9 <main+0x1c9>）
			if (instruction.comment) {
				const labelMatch = instruction.comment.match(/<([^>+]+)(\+0x[0-9a-f]+)?>/);
				if (labelMatch) {
					this.labelMap.set(labelMatch[1], i);
					console.log(`Mapped label ${labelMatch[1]} -> index ${i}`);
				}
			}
		}

		console.log(`Address mapping complete. Total addresses: ${this.addressToIndex.size}`);
		console.log(`Address range:`, Array.from(this.addressToIndex.keys()).sort());
		console.log(`Labels:`, Array.from(this.labelMap.keys()));
	}

	executeInstruction(instruction: AssemblyLine): ExecutionResult {
		try {
			// 変更追跡をクリア
			this.cpu.clearChangeTracking();
			this.jumped = false;
			this.jumpTarget = this.cpu.getPC(); // 現在PCで初期化（変更なしの場合）
			this.lastSystemCallResult = null;

			// 実行前の状態を保存
			this.cpu.saveSnapshot();

			// デバッグ用ログ
			console.log(`Executing instruction: ${instruction.mnemonic} ${instruction.operands.join(', ')}`);

			// 命令を実行
			this.dispatchInstruction(instruction);

			// 実行結果を返す
			const result: ExecutionResult = {
				success: true,
				registersChanged: Array.from(this.cpu.getChangedRegisters()),
				memoryChanged: this.getMemoryChanges(),
				flagsChanged: [], // TODO: フラグ変更追跡の実装
				pcChanged: this.jumped,
				jumped: this.jumped,
				jumpTarget: this.jumpTarget,
				programTerminated: this.jumped && this.jumpTarget === -1 // ジャンプしてターゲットが-1の場合のみ終了
			};

			// システムコール結果を含める
			if (this.lastSystemCallResult) {
				result.systemCallOutput = this.lastSystemCallResult.output;
				result.systemCallInputRequired = this.lastSystemCallResult.inputRequired;
				result.systemCallInputPrompt = this.lastSystemCallResult.inputPrompt;
			}

			console.log(`Execution successful for: ${instruction.mnemonic}`);
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Instruction execution failed';
			console.error(`Execution failed for instruction: ${instruction.mnemonic} ${instruction.operands.join(', ')}`);
			console.error(`Error: ${errorMessage}`);
			
			return {
				success: false,
				error: `${instruction.mnemonic}: ${errorMessage}`,
				registersChanged: [],
				memoryChanged: [],
				flagsChanged: []
			};
		}
	}

	private dispatchInstruction(instruction: AssemblyLine): void {
		const mnemonic = instruction.mnemonic.toLowerCase();
		const operands = instruction.operands;

		console.log(`Dispatching ${mnemonic} with operands: [${operands.join(', ')}]`);

		const handler = this.instructionMap.get(mnemonic);
		if (!handler) {
			throw new Error(`Unsupported instruction: ${mnemonic}. Supported instructions: ${Array.from(this.instructionMap.keys()).join(', ')}`);
		}

		// オペランド数の検証
		if (operands.length < handler.operandCount) {
			throw new Error(
				`Instruction ${mnemonic} requires ${handler.operandCount} operands, got ${operands.length}: [${operands.join(', ')}]`
			);
		}

		try {
			// 命令を実行
			if (handler.needsComment) {
				handler.execute(operands, instruction.comment);
			} else {
				handler.execute(operands);
			}
			console.log(`Successfully executed ${mnemonic}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to execute ${mnemonic} with operands [${operands.join(', ')}]: ${errorMessage}`);
		}
	}

	// === データ移動命令 ===

	private executeMovq(src: string, dest: string): void {
		const srcValue = this.resolveOperand(src, 8);
		this.setOperand(dest, srcValue.value, 8);
	}

	private executeMovl(src: string, dest: string): void {
		const srcValue = this.resolveOperand(src, 4);
		this.setOperand(dest, srcValue.value, 4);
	}

	private executeLeaq(src: string, dest: string): void {
		// LEA命令：有効アドレスの計算（メモリ読み出しはしない）
		
		// 絶対アドレスの場合（例: 0x0800004f）
		if (src.match(/^0x[0-9a-f]+$/i)) {
			const address = BigInt(parseInt(src, 16));
			this.setOperand(dest, address, 8);
			return;
		}
		
		// 10進数の絶対アドレスの場合（例: 123456）
		if (src.match(/^\d+$/)) {
			const address = BigInt(parseInt(src, 10));
			this.setOperand(dest, address, 8);
			return;
		}
		
		// メモリオペランドの場合（例: (%rip), 8(%rbp)）
		if (src.includes('(') && src.includes(')')) {
			const address = this.calculateMemoryAddress(src);
			this.setOperand(dest, address, 8);
			return;
		}
		
		// ラベル参照の場合 - 現在は固定値として処理
		// 実際のリンカーでは適切なアドレスに解決されるが、
		// シミュレーターでは仮の値を使用
		const labelAddress = BigInt(0x08000000); // 仮のベースアドレス
		this.setOperand(dest, labelAddress, 8);
	}

	// === スタック操作命令 ===

	private executePushq(src: string): void {
		const value = this.resolveOperand(src, 8);
		this.cpu.push(value.value, 8);
	}

	private executePopq(dest: string): void {
		const value = this.cpu.pop(8);
		this.setOperand(dest, value, 8);
	}

	private executeSubq(value: string, dest: string): void {
		const subtrahend = this.resolveOperand(value, 8);
		const currentValue = this.resolveOperand(dest, 8);
		const result = currentValue.value - subtrahend.value;

		this.setOperand(dest, result, 8);
		this.cpu.updateFlags(result, 64, 'sub');
	}

	private executeAddl(value: string, dest: string): void {
		const addend = this.resolveOperand(value, 4);
		const currentValue = this.resolveOperand(dest, 4);
		const result = currentValue.value + addend.value;

		this.setOperand(dest, result, 4);
		this.cpu.updateFlags(result, 32, 'add');
	}

	// === 比較・論理命令 ===

	private executeCmpb(src1: string, src2: string): void {
		const val1 = this.resolveOperand(src1, 1);
		const val2 = this.resolveOperand(src2, 1);
		const result = val2.value - val1.value;

		// CMP命令は結果をレジスタに格納せず、フラグのみ更新
		this.cpu.updateFlags(result, 8, 'cmp');
	}

	private executeMovzbl(src: string, dest: string): void {
		// ゼロ拡張付きバイト移動
		const srcValue = this.resolveOperand(src, 1);
		this.setOperand(dest, srcValue.value, 4); // 32bit先に移動（上位ビットは自動でクリア）
	}

	private executeCltq(): void {
		// Convert Long to Quad：EAXの32bit値をRAXに符号拡張
		const eax = this.cpu.getRegister('eax');

		// 32bit値の最上位ビットをチェック
		const signBit = (eax >> 31n) & 1n;
		let rax: bigint;

		if (signBit === 1n) {
			// 負の数：上位32bitを1で埋める
			rax = eax | 0xffffffff00000000n;
		} else {
			// 正の数：上位32bitを0で埋める
			rax = eax & 0xffffffffn;
		}

		this.cpu.setRegister('rax', rax);
	}

	private executeLeave(): void {
		// leave命令：movq %rbp, %rsp; popq %rbp の組み合わせ
		const rbp = this.cpu.getRegister('rbp');
		this.cpu.setRegister('rsp', rbp);
		const newRbp = this.cpu.pop(8);
		this.cpu.setRegister('rbp', newRbp);
	}

	// === 分岐命令 ===

	private executeJmp(target: string): void {
		// 無条件ジャンプ
		const targetIndex = this.resolveJumpTarget(target);
		this.performJump(targetIndex);
	}

	private executeJe(target: string): void {
		// ゼロフラグがセットされている場合にジャンプ
		if (this.cpu.getState().flags.zf) {
			const targetIndex = this.resolveJumpTarget(target);
			this.performJump(targetIndex);
		}
	}

	private executeJne(target: string): void {
		// ゼロフラグがセットされていない場合にジャンプ
		if (!this.cpu.getState().flags.zf) {
			const targetIndex = this.resolveJumpTarget(target);
			this.performJump(targetIndex);
		}
	}

	// === 関数呼び出し命令 ===

	private executeCallq(target: string): void {
		// 現在のPC（次の命令）をスタックにプッシュ
		const nextPC = this.cpu.getPC() + 1;
		this.cpu.push(BigInt(nextPC), 8);

		console.log(`CALLQ target: ${target}`);

		// 標準ライブラリ関数の特別処理
		const libraryFunctions = ['printf', '__isoc99_scanf', 'puts', 'malloc', 'free', 'strcmp', 'strlen', 'strcpy', 'memcpy'];
		const targetFunction = target.replace(/^_+/, ''); // アンダースコアプレフィックスを除去
		
		if (libraryFunctions.includes(targetFunction)) {
			console.log(`Calling library function: ${targetFunction}`);
			this.handleSystemCall(targetFunction);
			return;
		}

		// システムコール関数の検出と処理
		const targetAddress = this.extractTargetAddress(target);
		const functionName = SystemCallSimulator.getFunctionName(targetAddress);

		if (functionName && this.cpu.getSyscallSimulator()) {
			console.log(`Calling system function: ${functionName}`);
			this.handleSystemCall(functionName);
		} else {
			// 通常のジャンプ先に移動
			try {
				const targetIndex = this.resolveJumpTarget(target);
				console.log(`Jumping to index: ${targetIndex}`);
				this.performJump(targetIndex);
			} catch (error) {
				// ジャンプ先が見つからない場合は、ライブラリ関数として処理
				console.warn(`Jump target not found for ${target}, treating as library function`);
				this.handleSystemCall(targetFunction || target);
			}
		}
	}

	// ターゲット文字列からアドレスを抽出
	private extractTargetAddress(target: string): bigint {
		// "0x1c <main+0x1c>" 形式からアドレス部分を抽出
		const addressMatch = target.match(/^(0x[0-9a-f]+)/i);
		if (addressMatch) {
			return BigInt(addressMatch[1]);
		}

		// 直接的な16進数の場合
		if (target.startsWith('0x')) {
			return BigInt(target);
		}

		return 0n;
	}

	// システムコール処理
	private handleSystemCall(functionName: string): void {
		console.log(`Handling system call: ${functionName}`);
		
		const syscallSim = this.cpu.getSyscallSimulator();
		if (!syscallSim) {
			console.warn('No syscall simulator available');
			// システムコールシミュレーターがない場合はデフォルト処理
			this.cpu.setRegister('rax', 0n);
			
			// 復帰アドレスに戻る（スタックからポップ）
			const returnAddress = this.cpu.pop(8);
			this.jumped = true;
			
			if (returnAddress <= 0n) {
				this.jumpTarget = -1; // プログラム終了
			} else {
				this.jumpTarget = Number(returnAddress);
			}
			return;
		}

		// x86-64 System V ABI: rdi, rsi, rdx, rcx, r8, r9
		const rdi = this.cpu.getRegister('rdi');
		const rsi = this.cpu.getRegister('rsi');
		const rdx = this.cpu.getRegister('rdx');

		let result;

		switch (functionName) {
			case 'printf':
			case '__isoc99_printf':
				// printf(format, ...)
				console.log('Executing printf');
				result = syscallSim.handlePrintf(rdi, [rsi, rdx], this.cpu.getState().memory);
				break;

			case 'scanf':
			case '__isoc99_scanf':
				// scanf(format, buffer)
				console.log('Executing scanf');
				result = syscallSim.handleScanf(rdi, rsi, this.cpu.getState().memory);
				break;

			case 'puts':
				// puts(string)
				console.log('Executing puts');
				result = {
					success: true,
					returnValue: 1n,
					output: 'puts output\n' // 実際の実装では文字列を読み取る
				};
				break;

			case 'malloc':
				// malloc(size)
				console.log('Executing malloc');
				result = {
					success: true,
					returnValue: BigInt(0x08001000) // 仮のメモリアドレス
				};
				break;

			case 'free':
				// free(ptr)
				console.log('Executing free');
				result = {
					success: true,
					returnValue: 0n
				};
				break;

			default:
				// 未知の関数は何もしない（RAXに0を設定）
				console.warn(`Unknown function: ${functionName}, returning 0`);
				result = {
					success: true,
					returnValue: 0n
				};
		}

		// 戻り値をRAXに設定
		this.cpu.setRegister('rax', result.returnValue);

		// システムコール結果を記録（後でExecutionResultに含める）
		this.lastSystemCallResult = result;

		// 復帰アドレスに戻る（スタックからポップ）
		const returnAddress = this.cpu.pop(8);
		this.jumped = true;

		// 復帰アドレスが無効な場合はプログラム終了として扱う
		if (returnAddress <= 0n) {
			console.log('Program termination (invalid return address)');
			this.jumpTarget = -1; // プログラム終了
		} else {
			console.log(`Returning to address: ${returnAddress}`);
			this.jumpTarget = Number(returnAddress);
		}
	}

	private executeRetq(): void {
		// スタックから復帰アドレスをポップ
		const returnAddress = this.cpu.pop(8);

		// CPUのPCは更新しない（実行制御クラスが管理）
		// 代わりに、ジャンプフラグを設定
		this.jumped = true;

		// 復帰アドレスが無効な場合はプログラム終了として扱う
		if (returnAddress <= 0n) {
			this.jumpTarget = -1; // プログラム終了
		} else {
			this.jumpTarget = Number(returnAddress);
		}
	}

	// === ジャンプ関連のヘルパー ===

	private resolveTargetWithComment(operand: string, comment?: string): string {
		// コメント内にアドレス情報がある場合、それを優先する
		if (comment) {
			const commentAddressMatch = comment.match(/# (0x[0-9a-f]+) <.*>/i);
			if (commentAddressMatch) {
				return commentAddressMatch[1] + ' ' + comment.substring(comment.indexOf('<'));
			}
		}

		// オペランド自体がアドレスまたはラベルの場合
		return operand;
	}

	private resolveJumpTarget(target: string): number {
		target = target.trim();
		console.log(`Resolving jump target: ${target}`);

		// コメント形式のアドレス（例：0x1c <main+0x1c>）からアドレス部分を抽出
		const commentAddressMatch = target.match(/^(0x[0-9a-f]+)\s*<.*>$/i);
		if (commentAddressMatch) {
			target = commentAddressMatch[1];
		}

		// 16進数アドレスの場合
		if (target.startsWith('0x')) {
			// フォーマットを正規化（0x08000040 -> 08000040）
			const normalizedAddress = target.replace('0x', '').padStart(8, '0');
			
			// 正規化されたアドレスでマップを検索
			let targetIndex = this.addressToIndex.get(normalizedAddress);
			if (targetIndex !== undefined) {
				console.log(`Found target index: ${targetIndex} for address: ${normalizedAddress}`);
				return targetIndex;
			}
			
			// 元のフォーマットでも試行
			targetIndex = this.addressToIndex.get(target);
			if (targetIndex !== undefined) {
				console.log(`Found target index: ${targetIndex} for address: ${target}`);
				return targetIndex;
			}

			// コード範囲外のアドレスかもしれない（関数の終端など）
			const targetAddr = parseInt(target, 16);
			const availableAddresses = Array.from(this.addressToIndex.keys())
				.map((addr) => ({ 
					addr, 
					num: parseInt(addr, 16), 
					index: this.addressToIndex.get(addr)! 
				}))
				.sort((a, b) => a.num - b.num);

			console.log(`Available addresses:`, availableAddresses.map(a => `0x${a.num.toString(16)} -> ${a.index}`));
			console.log(`Target address: 0x${targetAddr.toString(16)}`);

			// ターゲットアドレスが最大アドレスより大きい場合はプログラム終了
			const maxAddress = Math.max(...availableAddresses.map(a => a.num));
			if (targetAddr > maxAddress) {
				console.log(`Target address 0x${targetAddr.toString(16)} is beyond code range (max: 0x${maxAddress.toString(16)}), terminating program`);
				return -1; // プログラム終了
			}

			// ターゲットアドレスより大きい最初のアドレスを見つける
			const nextAddress = availableAddresses.find(a => a.num > targetAddr);
			if (nextAddress) {
				console.log(`Target address 0x${targetAddr.toString(16)} not found, using next available: 0x${nextAddress.num.toString(16)} (index ${nextAddress.index})`);
				return nextAddress.index;
			}

			// 最後のアドレスを使用
			const lastAddress = availableAddresses[availableAddresses.length - 1];
			console.log(`Using last available address: 0x${lastAddress.num.toString(16)} (index ${lastAddress.index})`);
			return lastAddress.index;
		}

		// ラベル名の場合
		const targetIndex = this.labelMap.get(target);
		if (targetIndex !== undefined) {
			console.log(`Found label ${target} at index: ${targetIndex}`);
			return targetIndex;
		}

		console.error(`Jump target not found: ${target}`);
		console.log(`Available labels:`, Array.from(this.labelMap.keys()));
		throw new Error(`Jump target not found: ${target}`);
	}

	private performJump(targetIndex: number): void {
		this.jumped = true;
		this.jumpTarget = targetIndex;

		// プログラム終了の場合（targetIndex が -1）
		if (targetIndex === -1) {
			console.log('Program termination requested due to jump to address beyond code range');
			// プログラム終了フラグを設定するため、ExecutionResult に含める
			// この情報は executeInstruction で使用される
		} else {
			console.log(`Jumping to index: ${targetIndex}`);
		}
	}

	// === オペランド解析・操作 ===

	private resolveOperand(operand: string, size: number): OperandValue {
		operand = operand.trim();

		if (operand.startsWith('%')) {
			// レジスタオペランド
			const value = this.cpu.getRegister(operand);
			return {
				type: 'register',
				value,
				register: operand
			};
		} else if (operand.startsWith('$')) {
			// 即値オペランド
			const value = AssemblyParser.parseImmediate(operand);
			return {
				type: 'immediate',
				value
			};
		} else if (operand.includes('(') && operand.includes(')')) {
			// メモリオペランド
			const address = this.calculateMemoryAddress(operand);
			const value = this.cpu.readMemory(address, size);
			return {
				type: 'memory',
				value,
				address
			};
		} else if (operand.startsWith('var_') || operand.startsWith('arg_')) {
			// radare2のローカル変数参照を模擬的にメモリアドレスとして処理
			// var_4h -> スタックオフセット -4
			const match = operand.match(/^(var|arg)_([0-9a-f]+)h?$/i);
			if (match) {
				const [, varType, offsetStr] = match;
				const offset = BigInt(parseInt(offsetStr, 16));
				const rbp = this.cpu.getRegister('%rbp');
				const address = varType === 'var' ? rbp - offset : rbp + offset;
				const value = this.cpu.readMemory(address, size);
				return {
					type: 'memory',
					value,
					address
				};
			}
			throw new Error(`Unsupported variable format: ${operand}`);
		} else if (operand.match(/^[+-]?(?:0x[0-9a-f]+|\d+)$/i)) {
			// 16進数または10進数の即値（$プレフィックスなし）
			const value = AssemblyParser.parseImmediate('$' + operand);
			return {
				type: 'immediate',
				value
			};
		} else {
			// ラベルまたは未知のオペランド
			throw new Error(`Unsupported operand format: ${operand}`);
		}
	}

	private setOperand(operand: string, value: bigint, size: number): void {
		operand = operand.trim();

		if (operand.startsWith('%')) {
			// レジスタに設定
			this.cpu.setRegister(operand, value);
		} else if (operand.includes('(') && operand.includes(')')) {
			// メモリに設定
			const address = this.calculateMemoryAddress(operand);
			this.cpu.writeMemory(address, value, size);
		} else if (operand.startsWith('var_') || operand.startsWith('arg_')) {
			// radare2のローカル変数参照を模擬的にメモリアドレスとして処理
			const match = operand.match(/^(var|arg)_([0-9a-f]+)h?$/i);
			if (match) {
				const [, varType, offsetStr] = match;
				const offset = BigInt(parseInt(offsetStr, 16));
				const rbp = this.cpu.getRegister('%rbp');
				const address = varType === 'var' ? rbp - offset : rbp + offset;
				this.cpu.writeMemory(address, value, size);
			} else {
				throw new Error(`Cannot set value to variable: ${operand}`);
			}
		} else {
			throw new Error(`Cannot set value to operand: ${operand}`);
		}
	}

	private calculateMemoryAddress(memoryOperand: string): bigint {
		try {
			const parsed = AssemblyParser.parseMemoryOperand(memoryOperand);
			let address = 0n;

			// ベースレジスタ
			if (parsed.base) {
				address += this.cpu.getRegister(parsed.base);
			}

			// インデックスレジスタ
			if (parsed.index) {
				const indexValue = this.cpu.getRegister(parsed.index);
				const scale = BigInt(parsed.scale || 1);
				address += indexValue * scale;
			}

			// ディスプレイスメント
			if (parsed.displacement !== undefined) {
				address += BigInt(parsed.displacement);
			}

			return address;
		} catch (error) {
			// RIP相対アドレッシングの特殊処理
			if (memoryOperand.includes('%rip')) {
				// 簡易実装：現在のPCを基準とする
				// 実際の実装では命令の次のアドレスを使用する必要がある
				return BigInt(this.cpu.getPC() * 8); // 仮の計算
			}

			throw new Error(`Invalid memory operand: ${memoryOperand}`);
		}
	}

	private getMemoryChanges(): Array<{ address: bigint; value: number }> {
		const changes: Array<{ address: bigint; value: number }> = [];

		for (const address of this.cpu.getChangedMemory()) {
			const value = Number(this.cpu.readMemory(address, 1) & 0xffn);
			changes.push({ address, value });
		}

		return changes;
	}

	// === デバッグ・ユーティリティ ===

	getSupportedInstructions(): string[] {
		return Array.from(this.instructionMap.keys()).sort();
	}

	isInstructionSupported(mnemonic: string): boolean {
		return this.instructionMap.has(mnemonic.toLowerCase());
	}

	// ユーザー入力を処理してscanfを完了する
	processUserInput(userInput: string): ExecutionResult {
		const syscallSim = this.cpu.getSyscallSimulator();
		if (!syscallSim) {
			return {
				success: false,
				error: 'System call simulator not available',
				registersChanged: [],
				memoryChanged: [],
				flagsChanged: []
			};
		}

		const pendingInput = syscallSim.getPendingInput();
		if (!pendingInput) {
			return {
				success: false,
				error: 'No pending input request',
				registersChanged: [],
				memoryChanged: [],
				flagsChanged: []
			};
		}

		// scanf処理を再実行（ユーザー入力付き）
		const result = syscallSim.handleScanf(
			pendingInput.formatAddr,
			pendingInput.bufferAddr,
			this.cpu.getState().memory,
			userInput
		);

		// RAXに戻り値を設定
		this.cpu.setRegister('rax', result.returnValue);

		// 入力完了処理
		syscallSim.clearPendingInput();

		return {
			success: result.success,
			error: result.error,
			registersChanged: ['rax'],
			memoryChanged: this.getMemoryChanges(),
			flagsChanged: []
		};
	}
}
