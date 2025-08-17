// システムコールシミュレーション - printf/scanf等の標準ライブラリ関数
// x86-64 System V ABI calling convention: rdi, rsi, rdx, rcx, r8, r9

export interface SystemCallResult {
	success: boolean;
	returnValue: bigint;
	output?: string;
	inputRequired?: boolean;
	inputPrompt?: string;
	error?: string;
}

export interface SystemCallHandler {
	// printf系関数のシミュレーション
	handlePrintf(formatAddr: bigint, args: bigint[], memory: Map<bigint, number>): SystemCallResult;

	// scanf系関数のシミュレーション
	handleScanf(
		formatAddr: bigint,
		bufferAddr: bigint,
		memory: Map<bigint, number>,
		userInput?: string
	): SystemCallResult;

	// アドレスから文字列を読み取る
	readString(address: bigint, memory: Map<bigint, number>, maxLength?: number): string;

	// バッファに文字列を書き込む
	writeString(address: bigint, text: string, memory: Map<bigint, number>): void;
}

export class SystemCallSimulator implements SystemCallHandler {
	private outputBuffer: string[] = [];
	private pendingInput: {
		formatAddr: bigint;
		bufferAddr: bigint;
		prompt: string;
	} | null = null;

	constructor() {}

	handlePrintf(formatAddr: bigint, args: bigint[], memory: Map<bigint, number>): SystemCallResult {
		try {
			const format = this.readString(formatAddr, memory);

			// 簡単なprintf実装（%sのみサポート）
			let output = format;
			let argIndex = 0;

			// %sを実際の文字列に置換
			output = output.replace(/%s/g, () => {
				if (argIndex < args.length) {
					const argAddr = args[argIndex++];
					return this.readString(argAddr, memory);
				}
				return '%s';
			});

			// %dを数値に置換
			output = output.replace(/%d/g, () => {
				if (argIndex < args.length) {
					return args[argIndex++].toString();
				}
				return '%d';
			});

			// エスケープシーケンス処理
			output = output.replace(/\\n/g, '\n');
			output = output.replace(/\\t/g, '\t');

			this.outputBuffer.push(output);

			return {
				success: true,
				returnValue: BigInt(output.length),
				output: output
			};
		} catch (error) {
			return {
				success: false,
				returnValue: -1n,
				error: error instanceof Error ? error.message : 'System call failed'
			};
		}
	}

	handleScanf(
		formatAddr: bigint,
		bufferAddr: bigint,
		memory: Map<bigint, number>,
		userInput?: string
	): SystemCallResult {
		try {
			const format = this.readString(formatAddr, memory);

			// 入力待ち状態の場合
			if (!userInput) {
				// プロンプトを生成（フォーマット文字列から推測）
				let prompt = 'Input required';
				if (format.includes('%s')) {
					prompt = 'Enter a string:';
				} else if (format.includes('%d')) {
					prompt = 'Enter a number:';
				}

				this.pendingInput = {
					formatAddr,
					bufferAddr,
					prompt
				};

				return {
					success: true,
					returnValue: 0n,
					inputRequired: true,
					inputPrompt: prompt
				};
			}

			// 入力処理
			if (format.includes('%s')) {
				// 文字列入力
				this.writeString(bufferAddr, userInput, memory);
				return {
					success: true,
					returnValue: 1n // 成功した項目数
				};
			} else if (format.includes('%d')) {
				// 数値入力（まず文字列として保存）
				const numValue = parseInt(userInput, 10);
				if (!isNaN(numValue)) {
					// 32bit整数としてメモリに書き込み
					const bytes = new ArrayBuffer(4);
					const view = new DataView(bytes);
					view.setInt32(0, numValue, true); // little endian

					for (let i = 0; i < 4; i++) {
						memory.set(bufferAddr + BigInt(i), view.getUint8(i));
					}

					return {
						success: true,
						returnValue: 1n
					};
				} else {
					return {
						success: false,
						returnValue: 0n,
						error: 'Invalid number format'
					};
				}
			}

			// フォーマット文字列が空または不正の場合、デフォルトで文字列として扱う
			if (!format || format.trim() === '') {
				// 空のフォーマットの場合は文字列入力として処理
				this.writeString(bufferAddr, userInput, memory);
				return {
					success: true,
					returnValue: 1n
				};
			}

			// 未対応フォーマット
			return {
				success: false,
				returnValue: 0n,
				error: `Unsupported format: "${format}" (length: ${format.length})`
			};
		} catch (error) {
			return {
				success: false,
				returnValue: -1n,
				error: error instanceof Error ? error.message : 'System call failed'
			};
		}
	}

	readString(address: bigint, memory: Map<bigint, number>, maxLength: number = 1000): string {
		let result = '';
		let currentAddr = address;

		for (let i = 0; i < maxLength; i++) {
			const byte = memory.get(currentAddr) || 0;
			if (byte === 0) break; // null terminator

			result += String.fromCharCode(byte);
			currentAddr++;
		}

		return result;
	}

	writeString(address: bigint, text: string, memory: Map<bigint, number>): void {
		let currentAddr = address;

		for (let i = 0; i < text.length; i++) {
			memory.set(currentAddr, text.charCodeAt(i));
			currentAddr++;
		}

		// null terminator
		memory.set(currentAddr, 0);
	}

	// 出力バッファをクリア
	clearOutput(): void {
		this.outputBuffer = [];
	}

	// 出力内容を取得
	getOutput(): string {
		return this.outputBuffer.join('');
	}

	// 待機中の入力情報を取得
	getPendingInput(): {
		formatAddr: bigint;
		bufferAddr: bigint;
		prompt: string;
	} | null {
		return this.pendingInput;
	}

	// 入力完了処理
	clearPendingInput(): void {
		this.pendingInput = null;
	}

	// 既知の関数アドレスとのマッピング
	// 実際のプログラムでは動的リンクされるが、シミュレーションでは固定値を使用
	static readonly KNOWN_FUNCTIONS = new Map<bigint, string>([
		[0x1cn, 'printf'], // main+0x1c
		[0x37n, 'scanf'] // main+0x37
		// 他の標準ライブラリ関数も必要に応じて追加
	]);

	// 関数アドレスから関数名を取得
	static getFunctionName(address: bigint): string | undefined {
		return SystemCallSimulator.KNOWN_FUNCTIONS.get(address);
	}

	// サンプルプログラム用の文字列データを初期化
	initializeSampleData(memory: Map<bigint, number>): void {
		// CrazyLazyProgram2で使用される文字列をよく使われるアドレス範囲に配置
		// leaq命令で計算される可能性のあるアドレスに対応

		// printf用のフォーマット文字列パターン
		const printfFormats = [
			'Enter your input: ',
			'Please enter a string: ',
			'Input: ',
			'%s',
			'%d',
			''
		];

		// scanf用のフォーマット文字列パターン
		const scanfFormats = ['%s', '%d', '%c', ''];

		// よく使われるアドレス範囲に文字列を配置
		let baseAddr = 0x1000n;

		// printf用文字列
		for (const str of printfFormats) {
			this.writeString(baseAddr, str, memory);
			baseAddr += BigInt(str.length + 16); // 余裕を持たせて配置
		}

		// scanf用文字列
		for (const str of scanfFormats) {
			this.writeString(baseAddr, str, memory);
			baseAddr += BigInt(str.length + 16);
		}

		// さらに、0x0から0x10000の範囲で空のアドレスも初期化
		// （leaq命令で計算されるアドレスに対応するため）
		for (let addr = 0x0; addr < 0x1000; addr += 0x100) {
			this.writeString(BigInt(addr), '%s', memory);
		}
	}
}
