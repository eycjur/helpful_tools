// CPUシミュレーター - x86-64 CPU状態管理
import type { SystemCallSimulator } from './syscalls';

export interface RegisterSet {
	// 64-bit汎用レジスタ
	rax: bigint;
	rbx: bigint;
	rcx: bigint;
	rdx: bigint;
	rsi: bigint;
	rdi: bigint;
	rsp: bigint;
	rbp: bigint;
	// 拡張レジスタ R8-R15
	r8: bigint;
	r9: bigint;
	r10: bigint;
	r11: bigint;
	r12: bigint;
	r13: bigint;
	r14: bigint;
	r15: bigint;
}

export interface FlagsRegister {
	zf: boolean; // Zero Flag - 結果が0の場合セット
	sf: boolean; // Sign Flag - 結果が負の場合セット
	cf: boolean; // Carry Flag - キャリー発生時セット
	of: boolean; // Overflow Flag - オーバーフロー発生時セット
}

export interface CPUState {
	registers: RegisterSet;
	flags: FlagsRegister;
	memory: Map<bigint, number>;
	pc: number; // Program Counter
}

export interface RegisterChange {
	register: string;
	oldValue: bigint;
	newValue: bigint;
}

export interface MemoryChange {
	address: bigint;
	oldValue: number;
	newValue: number;
}

export interface StateSnapshot {
	registers: RegisterSet;
	flags: FlagsRegister;
	memory: Map<bigint, number>;
	pc: number;
	timestamp: number;
}

export class CPUSimulator {
	private state: CPUState;
	private history: StateSnapshot[] = [];
	private changedRegisters = new Set<string>();
	private changedMemory = new Set<bigint>();
	private syscallSimulator: SystemCallSimulator | null = null;

	constructor() {
		this.state = this.createInitialState();
	}

	// システムコールシミュレータを設定
	setSyscallSimulator(simulator: SystemCallSimulator): void {
		this.syscallSimulator = simulator;
	}

	// システムコールシミュレータを取得
	getSyscallSimulator(): SystemCallSimulator | null {
		return this.syscallSimulator;
	}

	private createInitialState(): CPUState {
		return {
			registers: {
				rax: 0n,
				rbx: 0n,
				rcx: 0n,
				rdx: 0n,
				rsi: 0n,
				rdi: 0n,
				rsp: 0x7fff_0000n, // 初期スタックポインタ
				rbp: 0n,
				r8: 0n,
				r9: 0n,
				r10: 0n,
				r11: 0n,
				r12: 0n,
				r13: 0n,
				r14: 0n,
				r15: 0n
			},
			flags: {
				zf: false,
				sf: false,
				cf: false,
				of: false
			},
			memory: new Map<bigint, number>(),
			pc: 0
		};
	}

	// === レジスタ操作 ===

	getRegister(name: string): bigint {
		const normalizedName = name.toLowerCase().replace('%', '');

		// 部分レジスタアクセス対応
		switch (normalizedName) {
			// RAX系
			case 'rax':
			case 'eax':
			case 'ax':
			case 'al':
			case 'ah':
				return this.applyRegisterMask(this.state.registers.rax, normalizedName);

			// RBX系
			case 'rbx':
			case 'ebx':
			case 'bx':
			case 'bl':
			case 'bh':
				return this.applyRegisterMask(this.state.registers.rbx, normalizedName);

			// RCX系
			case 'rcx':
			case 'ecx':
			case 'cx':
			case 'cl':
			case 'ch':
				return this.applyRegisterMask(this.state.registers.rcx, normalizedName);

			// RDX系
			case 'rdx':
			case 'edx':
			case 'dx':
			case 'dl':
			case 'dh':
				return this.applyRegisterMask(this.state.registers.rdx, normalizedName);

			// その他の汎用レジスタ
			case 'rsi':
			case 'esi':
			case 'si':
			case 'sil':
				return this.applyRegisterMask(this.state.registers.rsi, normalizedName);

			case 'rdi':
			case 'edi':
			case 'di':
			case 'dil':
				return this.applyRegisterMask(this.state.registers.rdi, normalizedName);

			case 'rsp':
			case 'esp':
			case 'sp':
			case 'spl':
				return this.applyRegisterMask(this.state.registers.rsp, normalizedName);

			case 'rbp':
			case 'ebp':
			case 'bp':
			case 'bpl':
				return this.applyRegisterMask(this.state.registers.rbp, normalizedName);

			// R8-R15拡張レジスタ
			case 'r8':
			case 'r8d':
			case 'r8w':
			case 'r8b':
				return this.applyRegisterMask(this.state.registers.r8, normalizedName);

			case 'r9':
			case 'r9d':
			case 'r9w':
			case 'r9b':
				return this.applyRegisterMask(this.state.registers.r9, normalizedName);

			case 'r10':
			case 'r10d':
			case 'r10w':
			case 'r10b':
				return this.applyRegisterMask(this.state.registers.r10, normalizedName);

			case 'r11':
			case 'r11d':
			case 'r11w':
			case 'r11b':
				return this.applyRegisterMask(this.state.registers.r11, normalizedName);

			case 'r12':
			case 'r12d':
			case 'r12w':
			case 'r12b':
				return this.applyRegisterMask(this.state.registers.r12, normalizedName);

			case 'r13':
			case 'r13d':
			case 'r13w':
			case 'r13b':
				return this.applyRegisterMask(this.state.registers.r13, normalizedName);

			case 'r14':
			case 'r14d':
			case 'r14w':
			case 'r14b':
				return this.applyRegisterMask(this.state.registers.r14, normalizedName);

			case 'r15':
			case 'r15d':
			case 'r15w':
			case 'r15b':
				return this.applyRegisterMask(this.state.registers.r15, normalizedName);

			default:
				throw new Error(`Unknown register: ${name}`);
		}
	}

	private applyRegisterMask(value: bigint, registerName: string): bigint {
		// Handle different register sizes and special cases
		if (registerName.endsWith('h')) {
			// High 8-bit registers (ah, bh, ch, dh)
			return (value >> 8n) & 0xffn;
		}

		// Determine register size and apply appropriate mask
		if (registerName.startsWith('r') && !registerName.match(/\d+[dwb]$/)) {
			// 64-bit registers (rax, rbx, etc.)
			return value;
		} else if (registerName.startsWith('e') || registerName.endsWith('d')) {
			// 32-bit registers (eax, ebx, r8d, etc.)
			return value & 0xffffffffn;
		} else if (
			['ax', 'bx', 'cx', 'dx', 'si', 'di', 'sp', 'bp'].includes(registerName) ||
			registerName.endsWith('w')
		) {
			// 16-bit registers (ax, bx, r8w, etc.)
			return value & 0xffffn;
		} else if (
			['al', 'bl', 'cl', 'dl', 'sil', 'dil', 'spl', 'bpl'].includes(registerName) ||
			registerName.endsWith('b')
		) {
			// 8-bit low registers (al, bl, r8b, etc.)
			return value & 0xffn;
		}

		// Default to 64-bit
		return value;
	}

	setRegister(name: string, value: bigint): void {
		const normalizedName = name.toLowerCase().replace('%', '');
		const baseRegister = this.getBaseRegister(normalizedName);

		// 変更を記録
		this.changedRegisters.add(baseRegister);

		// レジスタサイズに応じて値を設定
		const currentValue = this.state.registers[baseRegister as keyof RegisterSet];

		switch (this.getRegisterSize(normalizedName)) {
			case 64:
				(this.state.registers as any)[baseRegister] = value;
				break;
			case 32:
				// 32bitアクセスは上位32bitをクリア
				(this.state.registers as any)[baseRegister] = value & 0xffffffffn;
				break;
			case 16:
				// 16bitアクセスは下位16bitのみ変更
				(this.state.registers as any)[baseRegister] =
					(currentValue & 0xffffffffffff0000n) | (value & 0xffffn);
				break;
			case 8:
				if (normalizedName.endsWith('h')) {
					// 上位8bit (AH, BH, CH, DH)
					(this.state.registers as any)[baseRegister] =
						(currentValue & 0xffffffffffff00ffn) | ((value & 0xffn) << 8n);
				} else {
					// 下位8bit (AL, BL, CL, DL等)
					(this.state.registers as any)[baseRegister] =
						(currentValue & 0xffffffffffffff00n) | (value & 0xffn);
				}
				break;
		}
	}

	private getBaseRegister(registerName: string): string {
		// レジスタ名を64bit基本レジスタ名に正規化
		if (registerName.startsWith('r') && registerName.length <= 3) return registerName;
		if (registerName.startsWith('e')) return 'r' + registerName.slice(1);
		if (['ax', 'al', 'ah'].includes(registerName)) return 'rax';
		if (['bx', 'bl', 'bh'].includes(registerName)) return 'rbx';
		if (['cx', 'cl', 'ch'].includes(registerName)) return 'rcx';
		if (['dx', 'dl', 'dh'].includes(registerName)) return 'rdx';
		if (['si', 'sil'].includes(registerName)) return 'rsi';
		if (['di', 'dil'].includes(registerName)) return 'rdi';
		if (['sp', 'spl'].includes(registerName)) return 'rsp';
		if (['bp', 'bpl'].includes(registerName)) return 'rbp';

		// R8-R15
		const match = registerName.match(/^r(\d+)[dwb]?$/);
		if (match) return `r${match[1]}`;

		return registerName;
	}

	private getRegisterSize(registerName: string): number {
		if (registerName.startsWith('r') && !registerName.match(/\d+[dwb]$/)) return 64;
		if (registerName.startsWith('e') || registerName.endsWith('d')) return 32;
		if (
			['ax', 'bx', 'cx', 'dx', 'si', 'di', 'sp', 'bp'].includes(registerName) ||
			registerName.endsWith('w')
		)
			return 16;
		if (
			['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh', 'sil', 'dil', 'spl', 'bpl'].includes(
				registerName
			) ||
			registerName.endsWith('b')
		)
			return 8;
		return 64; // デフォルト
	}

	// === メモリ操作 ===

	readMemory(address: bigint, size: number = 8): bigint {
		let result = 0n;
		for (let i = 0; i < size; i++) {
			const byte = this.state.memory.get(address + BigInt(i)) || 0;
			result |= BigInt(byte) << (BigInt(i) * 8n);
		}
		return result;
	}

	writeMemory(address: bigint, value: bigint, size: number = 8): void {
		this.changedMemory.add(address);

		for (let i = 0; i < size; i++) {
			const byte = Number((value >> (BigInt(i) * 8n)) & 0xffn);
			this.state.memory.set(address + BigInt(i), byte);
		}
	}

	// スタック操作
	push(value: bigint, size: number = 8): void {
		this.state.registers.rsp -= BigInt(size);
		this.writeMemory(this.state.registers.rsp, value, size);
		this.changedRegisters.add('rsp');
	}

	pop(size: number = 8): bigint {
		const value = this.readMemory(this.state.registers.rsp, size);
		this.state.registers.rsp += BigInt(size);
		this.changedRegisters.add('rsp');
		return value;
	}

	// === フラグ管理 ===

	updateFlags(result: bigint, operationSize: number = 64, operation: string = 'generic'): void {
		// ゼロフラグ
		this.state.flags.zf = result === 0n;

		// サインフラグ（最上位ビット）
		const signBit = 1n << BigInt(operationSize - 1);
		this.state.flags.sf = (result & signBit) !== 0n;

		// キャリーフラグとオーバーフローフラグは演算固有
		if (operation.includes('add') || operation.includes('sub')) {
			this.updateArithmeticFlags(result, operationSize, operation);
		}
	}

	private updateArithmeticFlags(result: bigint, size: number, operation: string): void {
		const mask = (1n << BigInt(size)) - 1n;
		const maxValue = 1n << (BigInt(size) - 1n);

		// キャリーフラグ：結果がサイズを超過
		this.state.flags.cf = result > mask || result < 0n;

		// オーバーフローフラグ：符号付き演算での範囲外
		this.state.flags.of = result >= maxValue || result < -maxValue;
	}

	// === プログラムカウンタ操作 ===

	getPC(): number {
		return this.state.pc;
	}

	setPC(pc: number): void {
		this.state.pc = pc;
	}

	incrementPC(): void {
		this.state.pc++;
	}

	// === 状態管理 ===

	getState(): CPUState {
		return {
			registers: { ...this.state.registers },
			flags: { ...this.state.flags },
			memory: new Map(this.state.memory),
			pc: this.state.pc
		};
	}

	setState(state: CPUState): void {
		this.state = {
			registers: { ...state.registers },
			flags: { ...state.flags },
			memory: new Map(state.memory),
			pc: state.pc
		};
	}

	saveSnapshot(): void {
		this.history.push({
			...this.getState(),
			timestamp: Date.now()
		});

		// 履歴サイズ制限（最新100件）
		if (this.history.length > 100) {
			this.history.shift();
		}
	}

	getHistory(): StateSnapshot[] {
		return [...this.history];
	}

	reset(): void {
		this.state = this.createInitialState();
		this.history = [];
		this.changedRegisters.clear();
		this.changedMemory.clear();
	}

	// 変更されたレジスタ・メモリの追跡
	getChangedRegisters(): Set<string> {
		return new Set(this.changedRegisters);
	}

	getChangedMemory(): Set<bigint> {
		return new Set(this.changedMemory);
	}

	clearChangeTracking(): void {
		this.changedRegisters.clear();
		this.changedMemory.clear();
	}

	// === ユーティリティ ===

	formatRegister(value: bigint, format: 'hex' | 'dec' | 'bin' = 'hex'): string {
		switch (format) {
			case 'hex':
				return '0x' + value.toString(16).padStart(16, '0').toUpperCase();
			case 'dec':
				return value.toString(10);
			case 'bin':
				return '0b' + value.toString(2).padStart(64, '0');
			default:
				return value.toString();
		}
	}

	getMemoryDump(
		startAddress: bigint,
		size: number = 256
	): Array<{ address: bigint; value: number }> {
		const dump: Array<{ address: bigint; value: number }> = [];

		for (let i = 0; i < size; i++) {
			const addr = startAddress + BigInt(i);
			const value = this.state.memory.get(addr) || 0;
			dump.push({ address: addr, value });
		}

		return dump;
	}

	getStackView(depth: number = 32): Array<{ address: bigint; value: bigint }> {
		const stackView: Array<{ address: bigint; value: bigint }> = [];
		const currentSP = this.state.registers.rsp;

		for (let i = 0; i < depth; i++) {
			const addr = currentSP + BigInt(i * 8);
			const value = this.readMemory(addr, 8);
			stackView.push({ address: addr, value });
		}

		return stackView;
	}
}
