<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	const tool = tools.find((t) => t.name === 'assembly-simulator');

	// アセンブリ命令の型定義
	interface AssemblyInstruction {
		address: string;
		machineCode: string;
		instruction: string;
		operands: string;
		comment?: string;
	}

	// レジスタの状態管理
	interface RegisterState {
		rax: number;
		rbp: number;
		rsp: number;
		rdi: number;
		rsi: number;
		eax: number;
		al: number;
	}

	// フラグレジスタの状態
	interface FlagState {
		zf: boolean; // ゼロフラグ
		sf: boolean; // サインフラグ
		cf: boolean; // キャリーフラグ
	}

	// シミュレータの状態
	let assemblyInput = `CrazyLazyProgram2/CLP2.o:    file format elf64-x86-64

Disassembly of section .text:

0000000000000000 <main>:
       0: 55                               pushq    %rbp
       1: 48 89 e5                         movq    %rsp, %rbp
       4: 48 83 ec 30                      subq    $0x30, %rsp
       8: 48 8d 05 00 00 00 00             leaq    (%rip), %rax            # 0xf <main+0xf>
       f: 48 89 c7                         movq    %rax, %rdi
      12: b8 00 00 00 00                   movl    $0x0, %eax
      17: e8 00 00 00 00                   callq    0x1c <main+0x1c>
      1c: 48 8d 45 d0                      leaq    -0x30(%rbp), %rax
      20: 48 89 c6                         movq    %rax, %rsi
      23: 48 8d 05 00 00 00 00             leaq    (%rip), %rax            # 0x2a <main+0x2a>
      2a: 48 89 c7                         movq    %rax, %rdi
      2d: b8 00 00 00 00                   movl    $0x0, %eax
      32: e8 00 00 00 00                   callq    0x37 <main+0x37>
      37: c7 45 fc 00 00 00 00             movl    $0x0, -0x4(%rbp)
      3e: 90                               nop
      3f: 8b 45 fc                         movl    -0x4(%rbp), %eax
      42: 48 98                            cltq
      44: 0f b6 44 05 d0                   movzbl    -0x30(%rbp,%rax), %eax
      49: 3c 63                            cmpb    $0x63, %al
      4b: 0f 84 78 01 00 00                je    0x1c9 <main+0x1c9>`;

	let instructions: AssemblyInstruction[] = [];
	let registers: RegisterState = {
		rax: 0,
		rbp: 0x7fff00000000,
		rsp: 0x7fff00000000,
		rdi: 0,
		rsi: 0,
		eax: 0,
		al: 0
	};
	let flags: FlagState = {
		zf: false,
		sf: false,
		cf: false
	};
	let memory = new SvelteMap<number, number>();
	let addressMap = new SvelteMap<string, number>(); // アドレス→命令インデックス
	let callStack: number[] = []; // 関数呼び出しスタック
	let currentInstructionIndex = -1;
	let isRunning = false;
	let instructionListElement: HTMLElement;
	let executionHistory: string[] = [];

	// 標準入力システム
	let standardInput = '';
	let inputBuffer: string[] = [];
	let inputPointer = 0;

	// レジスタの解説データ
	const registerDescriptions: Record<string, string> = {
		RAX: '汎用レジスタ - 64bit。演算結果や戻り値に使用',
		RBP: 'ベースポインタ - 64bit。スタックフレームのベースアドレス',
		RSP: 'スタックポインタ - 64bit。現在のスタックトップを指す',
		RDI: '汎用レジスタ - 64bit。関数の第1引数や文字列操作の宛先',
		RSI: '汎用レジスタ - 64bit。関数の第2引数や文字列操作の送信元',
		EAX: 'RAXの下位32bit部分。32bit演算で使用',
		AL: 'RAXの最下位8bit部分。バイト単位の操作で使用',
		ZF: 'ゼロフラグ - 演算結果が0の時に1になる',
		SF: 'サインフラグ - 演算結果が負の時に1になる',
		CF: 'キャリーフラグ - 演算でオーバーフローした時に1になる'
	};

	// 命令の解説データ
	const instructionDescriptions: Record<string, string> = {
		pushq: 'スタックに64bitの値をプッシュ',
		popq: 'スタックから64bitの値をポップ',
		movq: '64bitデータを移動・コピー',
		movl: '32bitデータを移動・コピー (上位32bitはゼロクリア)',
		movzbl: 'バイトをゼロ拡張して32bitレジスタに移動',
		leaq: 'アドレス計算結果をレジスタにロード',
		subq: '64bit減算 (dest = dest - src)',
		addl: '32bit加算 (dest = dest + src)',
		cmpb: 'バイト比較 (フラグレジスタを設定)',
		cltq: 'EAXの符号を64bitに拡張してRAXに格納',
		callq: '関数呼び出し (戻りアドレスをスタックにプッシュ)',
		retq: '関数から復帰 (スタックから戻りアドレスをポップ)',
		je: 'ゼロフラグが1なら指定アドレスにジャンプ',
		jne: 'ゼロフラグが0なら指定アドレスにジャンプ',
		jmp: '無条件で指定アドレスにジャンプ',
		nop: '何も実行しない (CPUサイクル消費のみ)',
		leave: 'movq %rbp, %rsp; popq %rbp と同等'
	};

	// アセンブリコード解析
	function parseAssembly(input: string): AssemblyInstruction[] {
		const lines = input.split('\n').filter((line) => line.trim());
		const parsed: AssemblyInstruction[] = [];
		addressMap.clear(); // アドレスマップをクリア

		for (const line of lines) {
			// objdump形式の行をパース: "アドレス: 機械語 命令 オペランド コメント"
			const match = line.match(
				/^\s*([0-9a-f]+):\s+([0-9a-f]+(?:\s+[0-9a-f]+)*)\s+(\w+)(?:\s+([^#]*?))?(?:\s*#\s*(.*))?$/i
			);

			if (match) {
				const [, address, machineCode, instruction, operands = '', comment = ''] = match;
				const cleanAddress = address.trim();

				// アドレス→インデックスマッピングを構築
				addressMap.set(cleanAddress, parsed.length);
				addressMap.set('0x' + cleanAddress, parsed.length); // 0xプレフィックス付きも対応

				parsed.push({
					address: cleanAddress,
					machineCode: machineCode.trim(),
					instruction: instruction.trim(),
					operands: operands.trim(),
					comment: comment.trim()
				});
			}
		}

		console.log('Address mapping built:', Array.from(addressMap.entries()));
		return parsed;
	}

	// 16進数文字列を数値に変換
	function hexToNumber(hex: string): number {
		return parseInt(hex.replace(/[^0-9a-fA-F]/g, ''), 16) || 0;
	}

	// 数値を16進数文字列に変換
	function numberToHex(num: number): string {
		return '0x' + num.toString(16).padStart(8, '0');
	}

	// 16進数値をアスキー文字に変換（表示可能文字のみ）
	function hexToAscii(hex: string): string {
		const num = parseInt(hex.replace(/^0x/, ''), 16);
		// 表示可能なASCII文字（32-126）の場合のみ文字表示
		if (num >= 32 && num <= 126) {
			return `'${String.fromCharCode(num)}'`;
		}
		return '';
	}

	// オペランドの即値を解析してアスキー表示
	function parseOperandValue(operand: string): string {
		// $0x?? 形式の即値をチェック
		const immediateMatch = operand.match(/\$0x([0-9a-f]+)/i);
		if (immediateMatch) {
			const hexValue = immediateMatch[1];
			const ascii = hexToAscii(hexValue);
			return ascii ? ` ${ascii}` : '';
		}
		return '';
	}

	// 詳細な命令ヒントを生成
	function getDetailedInstructionHint(instruction: string, operands: string): string {
		const operandList = operands.split(',').map((op) => op.trim());

		switch (instruction) {
			case 'movq': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					return `<strong>実行:</strong> ${dest} ← ${src}<br><strong>結果:</strong> ${src}の64bit値を${dest}にコピー`;
				}
				return '';
			}

			case 'movl': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					const ascii = parseOperandValue(src);
					return `<strong>実行:</strong> ${dest} ← ${src}${ascii}<br><strong>結果:</strong> ${src}の32bit値を${dest}にコピー（上位32bitクリア）`;
				}
				return '';
			}

			case 'pushq': {
				return `<strong>実行:</strong> RSP ← RSP - 8; [RSP] ← ${operands}<br><strong>結果:</strong> スタックに${operands}の値をプッシュ`;
			}

			case 'popq': {
				return `<strong>実行:</strong> ${operands} ← [RSP]; RSP ← RSP + 8<br><strong>結果:</strong> スタックから値を${operands}にポップ`;
			}

			case 'subq': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					return `<strong>実行:</strong> ${dest} ← ${dest} - ${src}<br><strong>結果:</strong> ${dest}から${src}を減算`;
				}
				return '';
			}

			case 'addl': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					return `<strong>実行:</strong> ${dest} ← ${dest} + ${src}<br><strong>結果:</strong> ${dest}に${src}を加算、フラグ更新`;
				}
				return '';
			}

			case 'cmpb': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					const ascii = parseOperandValue(src);
					return `<strong>実行:</strong> ${dest} - ${src}${ascii} (結果破棄)<br><strong>結果:</strong> 比較結果をフラグレジスタに設定`;
				}
				return '';
			}

			case 'leaq': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					return `<strong>実行:</strong> ${dest} ← アドレス(${src})<br><strong>結果:</strong> ${src}の有効アドレスを${dest}に計算・格納`;
				}
				return '';
			}

			case 'movzbl': {
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					return `<strong>実行:</strong> ${dest} ← ゼロ拡張(byte[${src}])<br><strong>結果:</strong> ${src}から1バイト読み込み、ゼロ拡張して${dest}に格納`;
				}
				return '';
			}

			case 'cltq': {
				return `<strong>実行:</strong> RAX ← 符号拡張(EAX)<br><strong>結果:</strong> EAXを符号拡張して64bitのRAXに格納`;
			}

			case 'jmp': {
				return `<strong>実行:</strong> PC ← ${operands}<br><strong>結果:</strong> 無条件で${operands}アドレスにジャンプ`;
			}

			case 'je': {
				return `<strong>実行:</strong> if (ZF==1) PC ← ${operands}<br><strong>結果:</strong> ゼロフラグが立っていれば${operands}にジャンプ`;
			}

			case 'jne': {
				return `<strong>実行:</strong> if (ZF==0) PC ← ${operands}<br><strong>結果:</strong> ゼロフラグが立っていなければ${operands}にジャンプ`;
			}

			case 'callq': {
				return `<strong>実行:</strong> PUSH(戻りアドレス); PC ← ${operands}<br><strong>結果:</strong> 戻りアドレスをスタックに保存して${operands}の関数を呼び出し`;
			}

			case 'retq': {
				return `<strong>実行:</strong> PC ← POP()<br><strong>結果:</strong> スタックから戻りアドレスを取得して関数から復帰`;
			}

			case 'nop': {
				return `<strong>実行:</strong> 何もしない<br><strong>結果:</strong> CPUサイクルのみ消費`;
			}

			case 'leave': {
				return `<strong>実行:</strong> RSP ← RBP; RBP ← POP()<br><strong>結果:</strong> スタックフレームを破棄（関数終了処理）`;
			}

			default:
				return '';
		}
	}

	// フラグレジスタを設定
	function setFlags(result: number): void {
		flags.zf = result === 0;
		flags.sf = result < 0;
		flags.cf = result > 0xffffffff || result < -0x80000000;
	}

	// ジャンプ先アドレスを命令インデックスに変換
	function getJumpTarget(address: string): number {
		// "0x1c9 <main+0x1c9>" 形式から16進数アドレス部分を抽出
		const match = address.match(/0x([0-9a-f]+)/i);
		if (!match) return -1;

		const cleanAddr = match[1]; // "1c9"
		console.log(
			`Jump target lookup: ${address} -> ${cleanAddr} -> index ${addressMap.get(cleanAddr)}`
		);

		// アドレスマップから命令インデックスを取得
		const targetIndex = addressMap.get(cleanAddr);
		if (targetIndex !== undefined) {
			return targetIndex;
		}

		// 0xプレフィックス付きでも試す
		const withPrefix = '0x' + cleanAddr;
		const targetIndexWithPrefix = addressMap.get(withPrefix);
		if (targetIndexWithPrefix !== undefined) {
			return targetIndexWithPrefix;
		}

		console.warn(`Jump target not found: ${address} (cleaned: ${cleanAddr})`);
		return -1;
	}

	// 標準入力を準備
	function prepareInput(): void {
		inputBuffer = standardInput.split('\n').filter((line) => line.trim());
		inputPointer = 0;
	}

	// 標準入力から1行読み取り
	function readInput(): string {
		if (inputPointer < inputBuffer.length) {
			return inputBuffer[inputPointer++];
		}
		return '';
	}

	// 単一命令の実行（戻り値：次の命令インデックス、-1なら通常の次へ）
	function executeInstruction(instruction: AssemblyInstruction): number {
		const { instruction: cmd, operands } = instruction;
		const operandList = operands.split(',').map((op) => op.trim());

		executionHistory.push(`${instruction.address}: ${cmd} ${operands}`);

		switch (cmd) {
			case 'pushq':
				registers.rsp -= 8;
				if (operands === '%rbp') {
					memory.set(registers.rsp, registers.rbp);
				}
				break;

			case 'popq':
				if (operands === '%rbp') {
					registers.rbp = memory.get(registers.rsp) || 0;
				}
				registers.rsp += 8;
				break;

			case 'movq':
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					if (src === '%rsp' && dest === '%rbp') {
						registers.rbp = registers.rsp;
					} else if (src === '%rax' && dest === '%rdi') {
						registers.rdi = registers.rax;
					} else if (src === '%rax' && dest === '%rsi') {
						registers.rsi = registers.rax;
					}
				}
				break;

			case 'subq':
				if (operandList[1] === '%rsp') {
					const value = hexToNumber(operandList[0].replace('$', ''));
					registers.rsp -= value;
				}
				break;

			case 'leaq':
				// 有効アドレス計算（簡略化）
				if (operands.includes('(%rip)')) {
					// RIP相対アドレス
					registers.rax = 0x400000 + parseInt(instruction.address, 16);
				} else if (operands.includes('(%rbp)')) {
					// ベースポインタ相対
					const offset = operands.match(/-?0x[0-9a-f]+/i)?.[0] || '0';
					registers.rax = registers.rbp + hexToNumber(offset);
				}
				break;

			case 'movl':
				if (operandList.length === 2) {
					const [src, dest] = operandList;
					if (src.startsWith('$')) {
						const value = hexToNumber(src.replace('$', ''));
						if (dest === '%eax') {
							registers.eax = value;
							registers.rax = value;
						}
					} else if (src.includes('(%rbp)')) {
						// メモリから読み込み
						const offset = src.match(/-?0x[0-9a-f]+/i)?.[0] || '-0x4';
						const addr = registers.rbp + hexToNumber(offset);
						registers.eax = memory.get(addr) || 0;
					}
					// メモリに書き込み
					if (dest.includes('(%rbp)')) {
						const offset = dest.match(/-?0x[0-9a-f]+/i)?.[0] || '-0x4';
						const addr = registers.rbp + hexToNumber(offset);
						const value = hexToNumber(src.replace('$', ''));
						memory.set(addr, value);
					}
				}
				break;

			case 'cltq':
				// EAXを符号拡張してRAXに
				registers.rax = registers.eax;
				break;

			case 'movzbl':
				// ゼロ拡張バイトロード（文字読み込みをシミュレート）
				if (operands.includes('(%rbp,%rax)')) {
					// 配列アクセス風の処理
					const char = readInput().charCodeAt(0) || 0;
					registers.eax = char;
					registers.al = char & 0xff;
				} else {
					registers.eax = Math.floor(Math.random() * 256);
					registers.al = registers.eax & 0xff;
				}
				break;

			case 'cmpb': {
				// バイト比較とフラグ設定
				if (operandList.length === 2) {
					const [value1, value2] = operandList;
					const val1 = value1.startsWith('$') ? hexToNumber(value1.replace('$', '')) : registers.al;
					const val2 = value2 === '%al' ? registers.al : hexToNumber(value2.replace('$', ''));
					const result = val2 - val1;
					console.log(
						`cmpb: ${value2}(${val2}) - ${value1}(${val1}) = ${result}, setting ZF=${result === 0}`
					);
					setFlags(result);
				}
				break;
			}

			case 'addl':
				if (operandList[1].includes('(%rbp)')) {
					const offset = operandList[1].match(/-?0x[0-9a-f]+/i)?.[0] || '-0x4';
					const addr = registers.rbp + hexToNumber(offset);
					const currentValue = memory.get(addr) || 0;
					const newValue = currentValue + 1;
					memory.set(addr, newValue);
					setFlags(newValue);
				}
				break;

			case 'nop':
				// 何もしない
				break;

			// ジャンプ命令群
			case 'jmp': {
				const jmpTarget = getJumpTarget(operands);
				return jmpTarget;
			}

			case 'je': {
				console.log(`je instruction: operands=${operands}, ZF=${flags.zf}`);
				if (flags.zf) {
					const jeTarget = getJumpTarget(operands);
					console.log(`je condition met, jumping to target: ${jeTarget}`);
					return jeTarget;
				} else {
					console.log('je condition not met, continuing');
				}
				break;
			}

			case 'jne':
				if (!flags.zf) {
					const jneTarget = getJumpTarget(operands);
					return jneTarget;
				}
				break;

			case 'callq': {
				// 関数呼び出し - 戻りアドレスをスタックにプッシュ
				registers.rsp -= 8; // スタックポインタを8バイト減算
				const returnAddress = currentInstructionIndex + 1;
				memory.set(registers.rsp, returnAddress); // メモリに戻りアドレスを保存
				callStack.push(returnAddress); // デバッグ用のcallStackも更新
				const callTarget = getJumpTarget(operands);
				return callTarget;
			}

			case 'retq':
				// 関数復帰 - スタックから戻りアドレスをポップ
				const returnAddress = memory.get(registers.rsp) || 0;
				registers.rsp += 8; // スタックポインタを8バイト加算
				callStack.pop(); // デバッグ用のcallStackも更新
				return returnAddress;
				break;

			case 'leave':
				// movq %rbp, %rsp; popq %rbp と同等
				registers.rsp = registers.rbp;
				registers.rbp = memory.get(registers.rsp) || 0;
				registers.rsp += 8;
				break;

			default:
				console.log(`Unknown instruction: ${cmd}`);
		}

		// レジスタの依存関係を更新
		registers.eax = registers.rax & 0xffffffff;
		registers.al = registers.rax & 0xff;

		return -1; // 通常の次の命令へ
	}

	// ステップ実行
	function stepExecute(): void {
		if (currentInstructionIndex >= instructions.length - 1) return;

		if (currentInstructionIndex === -1) {
			currentInstructionIndex = 0;
			prepareInput(); // 初回実行時に標準入力を準備
		} else {
			currentInstructionIndex++;
		}

		const nextIndex = executeInstruction(instructions[currentInstructionIndex]);

		// ジャンプ先がある場合は移動
		if (nextIndex !== -1 && nextIndex >= 0 && nextIndex < instructions.length) {
			currentInstructionIndex = nextIndex; // 直接ジャンプ先に移動
		}

		// 現在実行中の命令を中央にスクロール
		scrollToCurrentInstruction();
	}

	// 現在実行中の命令を中央にスクロール
	function scrollToCurrentInstruction(): void {
		if (!instructionListElement) return;

		const currentElement = instructionListElement.querySelector(
			`[data-instruction-index="${currentInstructionIndex}"]`
		);
		if (currentElement) {
			// 解析済み命令コンテナ内でのスクロールのみ実行
			const container = instructionListElement.parentElement;
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const elementRect = currentElement.getBoundingClientRect();
				
				// 要素がコンテナの表示範囲外にある場合のみスクロール
				const isAbove = elementRect.top < containerRect.top;
				const isBelow = elementRect.bottom > containerRect.bottom;
				
				if (isAbove || isBelow) {
					const scrollTop = container.scrollTop;
					const elementTop = currentElement.offsetTop;
					const containerHeight = container.clientHeight;
					const elementHeight = currentElement.offsetHeight;
					
					// 要素をコンテナの中央に配置
					const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
					
					container.scrollTo({
						top: targetScrollTop,
						behavior: 'smooth'
					});
				}
			}
		}
	}

	// 連続実行
	function runAll(): void {
		isRunning = true;
		const interval = setInterval(() => {
			if (currentInstructionIndex >= instructions.length - 1) {
				clearInterval(interval);
				isRunning = false;
				return;
			}
			stepExecute();
		}, 100);
	}

	// リセット
	function reset(): void {
		isRunning = false;
		currentInstructionIndex = -1;
		registers = {
			rax: 0,
			rbp: 0x7fff00000000,
			rsp: 0x7fff00000000,
			rdi: 0,
			rsi: 0,
			eax: 0,
			al: 0
		};
		flags = {
			zf: false,
			sf: false,
			cf: false
		};
		memory.clear();
		callStack = [];
		executionHistory = [];
		inputPointer = 0;
		prepareInput();
	}

	// 入力変更時にパース実行
	$: instructions = parseAssembly(assemblyInput);

	onMount(() => {
		reset();
	});
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 制御パネル -->
	<div class="mb-6 flex gap-4">
		<button
			on:click={stepExecute}
			disabled={isRunning || currentInstructionIndex >= instructions.length - 1}
			class="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:bg-gray-400"
		>
			ステップ実行
		</button>
		<button
			on:click={runAll}
			disabled={isRunning || currentInstructionIndex >= instructions.length - 1}
			class="rounded bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:bg-gray-400"
		>
			連続実行
		</button>
		<button
			on:click={reset}
			class="rounded bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600"
		>
			リセット
		</button>
		<div class="flex items-center text-sm text-gray-600">
			命令: {currentInstructionIndex + 1} / {instructions.length}
		</div>
	</div>

	<!-- メインコンテンツ：3カラムレイアウト -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- アセンブリコード入力・表示 -->
		<div class="lg:col-span-1">
			<h2 class="mb-3 text-lg font-semibold">アセンブリコード</h2>
			<textarea
				bind:value={assemblyInput}
				rows="20"
				class="w-full resize-y rounded-lg border border-gray-300 p-3 font-mono text-sm"
				placeholder="objdump形式のアセンブリコードを入力してください..."
			></textarea>			<h2 class="mb-3 text-lg font-semibold">解析済み命令</h2>
			<!-- 命令リスト表示 -->
			<div
				class="max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-3"
			>
				<div bind:this={instructionListElement} class="space-y-1">
					{#each instructions as instruction, index (instruction.address)}
						<div
							data-instruction-index={index}
							class="rounded p-1 font-mono text-xs {currentInstructionIndex === index
								? 'bg-yellow-200'
								: ''}"
						>
							<span class="text-gray-500">{instruction.address}:</span>
							<span class="group relative cursor-help text-blue-600">
								{instruction.instruction}
								{#if instructionDescriptions[instruction.instruction]}
									<span
										class="invisible absolute top-full left-0 z-50 mt-1 max-w-lg min-w-80 rounded bg-gray-800 px-3 py-2 text-xs whitespace-normal text-white shadow-lg group-hover:visible"
									>
										<div class="mb-1 font-semibold">
											{instruction.instruction}
											{instruction.operands}
										</div>
										<div class="text-xs">
											{#each getDetailedInstructionHint(instruction.instruction, instruction.operands).split('<br>') as line, idx (idx)}
												<div>
													{#if line.includes('<strong>')}
														{@const [prefix, content] = line.split('</strong>')}
														<strong>{prefix.replace('<strong>', '')}</strong>{content || ''}
													{:else}
														{line}
													{/if}
												</div>
											{/each}
										</div>
									</span>
								{/if}
							</span>
							<span class="text-gray-700">
								{instruction.operands}
								<span class="text-green-500">{parseOperandValue(instruction.operands)}</span>
							</span>
							{#if instruction.comment}
								<span class="text-green-600"># {instruction.comment}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- レジスタ状態 -->
		<div class="lg:col-span-1">
			<h2 class="mb-3 text-lg font-semibold">レジスタ状態</h2>
			<div class="rounded-lg border border-gray-300 bg-white p-4">
				<div class="space-y-2 font-mono text-sm">
					<div class="grid grid-cols-3 gap-2">
						<span class="font-semibold">レジスタ</span>
						<span class="font-semibold">16進数</span>
						<span class="font-semibold">10進数</span>
					</div>
					<hr />
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['RAX']}
						>
							RAX:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['RAX']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.rax)}</span>
						<span class="text-gray-600">{registers.rax}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['RBP']}
						>
							RBP:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['RBP']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.rbp)}</span>
						<span class="text-gray-600">{registers.rbp}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['RSP']}
						>
							RSP:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['RSP']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.rsp)}</span>
						<span class="text-gray-600">{registers.rsp}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['RDI']}
						>
							RDI:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['RDI']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.rdi)}</span>
						<span class="text-gray-600">{registers.rdi}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['RSI']}
						>
							RSI:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['RSI']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.rsi)}</span>
						<span class="text-gray-600">{registers.rsi}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['EAX']}
						>
							EAX:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['EAX']}
							</span>
						</span>
						<span class="text-blue-600">{numberToHex(registers.eax)}</span>
						<span class="text-gray-600">{registers.eax}</span>
					</div>
					<div class="grid grid-cols-3 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['AL']}
						>
							AL:
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['AL']}
							</span>
						</span>
						<span class="text-blue-600">0x{registers.al.toString(16).padStart(2, '0')}</span>
						<span class="text-gray-600">{registers.al}</span>
					</div>
				</div>
			</div>

			<!-- フラグレジスタ -->
			<h3 class="mt-6 mb-3 text-lg font-semibold">フラグレジスタ</h3>
			<div class="rounded-lg border border-gray-300 bg-white p-4">
				<div class="space-y-2 font-mono text-sm">
					<div class="grid grid-cols-2 gap-2">
						<span class="font-semibold">フラグ</span>
						<span class="font-semibold">状態</span>
					</div>
					<hr />
					<div class="grid grid-cols-2 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['ZF']}
						>
							ZF (ゼロ):
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['ZF']}
							</span>
						</span>
						<span class="text-blue-600">{flags.zf ? '1' : '0'}</span>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['SF']}
						>
							SF (サイン):
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['SF']}
							</span>
						</span>
						<span class="text-blue-600">{flags.sf ? '1' : '0'}</span>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<span
							class="group relative cursor-help font-semibold"
							title={registerDescriptions['CF']}
						>
							CF (キャリー):
							<span
								class="invisible absolute top-full left-0 z-50 mt-1 rounded bg-gray-800 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg group-hover:visible"
							>
								{registerDescriptions['CF']}
							</span>
						</span>
						<span class="text-blue-600">{flags.cf ? '1' : '0'}</span>
					</div>
				</div>
			</div>

			<!-- コールスタック -->
			<h3 class="mt-6 mb-3 text-lg font-semibold">コールスタック</h3>
			<div class="rounded-lg border border-gray-300 bg-white p-4">
				<div class="space-y-1 font-mono text-sm">
					{#if callStack.length === 0}
						<div class="text-gray-500">スタック空</div>
					{:else}
						{#each callStack.slice().reverse() as returnIndex, index (index)}
							<div class="grid grid-cols-2 gap-2">
								<span class="text-gray-600">戻り先{index + 1}:</span>
								<span class="text-blue-600">{instructions[returnIndex]?.address || 'N/A'}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- メモリ状態 -->
			<h3 class="mt-6 mb-3 text-lg font-semibold">スタックメモリ</h3>
			<div class="rounded-lg border border-gray-300 bg-white p-4">
				<div class="space-y-1 font-mono text-sm">
					{#if memory.size === 0}
						<div class="text-gray-500">メモリ使用なし</div>
					{:else}
						{#each Array.from(memory.entries()).sort(([a], [b]) => b - a) as [addr, value] (addr)}
							<div class="grid grid-cols-2 gap-2">
								<span class="text-gray-600">{numberToHex(addr)}</span>
								<span class="text-blue-600">{numberToHex(value)}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<!-- 実行履歴・標準入力 -->
		<div class="lg:col-span-1">
			<!-- 標準入力 -->
			<h2 class="mb-3 text-lg font-semibold">標準入力</h2>
			<div class="mb-6">
				<textarea
					bind:value={standardInput}
					rows="4"
					class="w-full resize-none rounded-lg border border-gray-300 p-3 font-mono text-sm"
					placeholder="プログラムに入力するデータを1行ずつ入力してください..."
				></textarea>
				<div class="mt-2 text-xs text-gray-500">
					<strong>入力ポインタ:</strong>
					{inputPointer} / {inputBuffer.length}
				</div>
			</div>

			<h2 class="mb-3 text-lg font-semibold">実行履歴</h2>
			<div class="max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-3">
				{#if executionHistory.length === 0}
					<div class="text-gray-500">実行履歴なし</div>
				{:else}
					{#each executionHistory as entry, index (index)}
						<div class="border-b border-gray-200 py-1 font-mono text-xs">
							<span class="text-gray-400">{index + 1}.</span>
							<span class="text-gray-700">{entry}</span>
						</div>
					{/each}
				{/if}
			</div>

			<!-- 使用方法 -->
			<div class="mt-6 rounded-lg bg-blue-50 p-4">
				<h3 class="mb-2 font-semibold">使用方法</h3>
				<ul class="space-y-1 text-sm text-gray-700">
					<li>• objdump形式のアセンブリコードを左側に入力</li>
					<li>• 標準入力が必要な場合は右上のテキストエリアにデータを入力</li>
					<li>• 「ステップ実行」で1命令ずつ実行</li>
					<li>• 「連続実行」で全命令を自動実行</li>
					<li>• ジャンプ命令（jmp, je, jne等）とフラグが正確に動作</li>
					<li>• 関数呼び出し（callq, retq）とコールスタックも対応</li>
					<li>• レジスタ、フラグ、メモリの変化を観察</li>
					<li>• 「リセット」で初期状態に戻る</li>
				</ul>
			</div>
		</div>
	</div>
</div>
