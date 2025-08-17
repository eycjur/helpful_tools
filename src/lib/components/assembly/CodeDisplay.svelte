<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '@iconify/svelte';
	import type { AssemblyLine } from '$lib/assembly/parser';
	import { getFullDescription, type OpcodeDoc } from '$lib/assembly/opcode-docs';
	import {
		getRegisterFullDescription,
		isRegister,
		type RegisterDoc
	} from '$lib/assembly/register-docs';

	export let instructions: AssemblyLine[] = [];
	export let currentPC: number = 0;
	export let breakpoints: Set<number> = new Set();
	export let inputCode: string = '';

	const dispatch = createEventDispatcher();

	// ツールチップ状態管理
	let tooltip = {
		visible: false,
		x: 0,
		y: 0,
		content: null as (OpcodeDoc | RegisterDoc) | null,
		type: 'opcode' as 'opcode' | 'register'
	};

	// サンプルアセンブリコード（リロケーション情報付き新フォーマット）
	const sampleCode = `
CLP2.o:	file format elf64-x86-64

Disassembly of section .text:

0000000000000000 <main>:
       0:      	pushq	%rbp
       1:      	movq	%rsp, %rbp
       4:      	subq	$0x30, %rsp
       8:      	leaq	(%rip), %rax            # 0xf <main+0xf>
		000000000000000b:  R_X86_64_PC32	.rodata-0x4
       f:      	movq	%rax, %rdi
      12:      	movl	$0x0, %eax
      17:      	callq	0x1c <main+0x1c>
		0000000000000018:  R_X86_64_PLT32	printf-0x4
      1c:      	leaq	-0x30(%rbp), %rax
      20:      	movq	%rax, %rsi
      23:      	leaq	(%rip), %rax            # 0x2a <main+0x2a>
		0000000000000026:  R_X86_64_PC32	.rodata+0xd
      2a:      	movq	%rax, %rdi
      2d:      	movl	$0x0, %eax
      32:      	callq	0x37 <main+0x37>
		0000000000000033:  R_X86_64_PLT32	__isoc99_scanf-0x4
      37:      	movl	$0x0, -0x4(%rbp)
      3e:      	nop
      3f:      	movl	-0x4(%rbp), %eax
      42:      	cltq
      44:      	movzbl	-0x30(%rbp,%rax), %eax
      49:      	cmpb	$0x63, %al
      4b:      	je	0x1c9 <main+0x1c9>
      51:      	jmp	0x3b3 <main+0x3b3>
      56:      	addl	$0x1, -0x4(%rbp)
      5a:      	nop
      5b:      	movl	-0x4(%rbp), %eax
      5e:      	cltq
      60:      	movzbl	-0x30(%rbp,%rax), %eax
      65:      	cmpb	$0x4f, %al
      67:      	jne	0x385 <main+0x385>
      6d:      	addl	$0x1, -0x4(%rbp)
      71:      	nop
      72:      	movl	-0x4(%rbp), %eax
      75:      	cltq
      77:      	movzbl	-0x30(%rbp,%rax), %eax
      7c:      	cmpb	$0x54, %al
      7e:      	jne	0x388 <main+0x388>
      84:      	addl	$0x1, -0x4(%rbp)
      88:      	nop
      89:      	movl	-0x4(%rbp), %eax
      8c:      	cltq
      8e:      	movzbl	-0x30(%rbp,%rax), %eax
      93:      	cmpb	$0x4f, %al
      95:      	jne	0x38b <main+0x38b>
      9b:      	addl	$0x1, -0x4(%rbp)
      9f:      	nop
      a0:      	movl	-0x4(%rbp), %eax
      a3:      	cltq
      a5:      	movzbl	-0x30(%rbp,%rax), %eax
      aa:      	cmpb	$0x5f, %al
      ac:      	je	0x1e5 <main+0x1e5>
      b2:      	jmp	0x3b3 <main+0x3b3>
      b7:      	addl	$0x1, -0x4(%rbp)
      bb:      	nop
      bc:      	movl	-0x4(%rbp), %eax
      bf:      	cltq
      c1:      	movzbl	-0x30(%rbp,%rax), %eax
      c6:      	cmpb	$0x5f, %al
      c8:      	je	0x2c6 <main+0x2c6>
      ce:      	jmp	0x3b3 <main+0x3b3>
      d3:      	addl	$0x1, -0x4(%rbp)
      d7:      	nop
      d8:      	movl	-0x4(%rbp), %eax
      db:      	cltq
      dd:      	movzbl	-0x30(%rbp,%rax), %eax
      e2:      	cmpb	$0x34, %al
      e4:      	jne	0x38e <main+0x38e>
      ea:      	addl	$0x1, -0x4(%rbp)
      ee:      	nop
      ef:      	movl	-0x4(%rbp), %eax
      f2:      	cltq
      f4:      	movzbl	-0x30(%rbp,%rax), %eax
      f9:      	cmpb	$0x62, %al
      fb:      	je	0x359 <main+0x359>
     101:      	jmp	0x3b3 <main+0x3b3>
     106:      	addl	$0x1, -0x4(%rbp)
     10a:      	nop
     10b:      	movl	-0x4(%rbp), %eax
     10e:      	cltq
     110:      	movzbl	-0x30(%rbp,%rax), %eax
     115:      	cmpb	$0x30, %al
     117:      	jne	0x391 <main+0x391>
     11d:      	addl	$0x1, -0x4(%rbp)
     121:      	nop
     122:      	movl	-0x4(%rbp), %eax
     125:      	cltq
     127:      	movzbl	-0x30(%rbp,%rax), %eax
     12c:      	cmpb	$0x54, %al
     12e:      	jne	0x394 <main+0x394>
     134:      	addl	$0x1, -0x4(%rbp)
     138:      	nop
     139:      	movl	-0x4(%rbp), %eax
     13c:      	cltq
     13e:      	movzbl	-0x30(%rbp,%rax), %eax
     143:      	cmpb	$0x30, %al
     145:      	je	0x27c <main+0x27c>
     14b:      	jmp	0x3b3 <main+0x3b3>
     150:      	addl	$0x1, -0x4(%rbp)
     154:      	nop
     155:      	movl	-0x4(%rbp), %eax
     158:      	cltq
     15a:      	movzbl	-0x30(%rbp,%rax), %eax
     15f:      	cmpb	$0x5f, %al
     161:      	jne	0x397 <main+0x397>
     167:      	addl	$0x1, -0x4(%rbp)
     16b:      	nop
     16c:      	movl	-0x4(%rbp), %eax
     16f:      	cltq
     171:      	movzbl	-0x30(%rbp,%rax), %eax
     176:      	cmpb	$0x4e, %al
     178:      	jne	0x39a <main+0x39a>
     17e:      	addl	$0x1, -0x4(%rbp)
     182:      	nop
     183:      	movl	-0x4(%rbp), %eax
     186:      	cltq
     188:      	movzbl	-0x30(%rbp,%rax), %eax
     18d:      	cmpb	$0x30, %al
     18f:      	jne	0x39d <main+0x39d>
     195:      	addl	$0x1, -0x4(%rbp)
     199:      	nop
     19a:      	movl	-0x4(%rbp), %eax
     19d:      	cltq
     19f:      	movzbl	-0x30(%rbp,%rax), %eax
     1a4:      	cmpb	$0x6d, %al
     1a6:      	je	0x264 <main+0x264>
     1ac:      	jmp	0x3b3 <main+0x3b3>
     1b1:      	addl	$0x1, -0x4(%rbp)
     1b5:      	nop
     1b6:      	movl	-0x4(%rbp), %eax
     1b9:      	cltq
     1bb:      	movzbl	-0x30(%rbp,%rax), %eax
     1c0:      	cmpb	$0x7d, %al
     1c2:      	je	0x201 <main+0x201>
     1c4:      	jmp	0x3b3 <main+0x3b3>
     1c9:      	addl	$0x1, -0x4(%rbp)
     1cd:      	nop
     1ce:      	movl	-0x4(%rbp), %eax
     1d1:      	cltq
     1d3:      	movzbl	-0x30(%rbp,%rax), %eax
     1d8:      	cmpb	$0x74, %al
     1da:      	je	0x327 <main+0x327>
     1e0:      	jmp	0x3b3 <main+0x3b3>
     1e5:      	addl	$0x1, -0x4(%rbp)
     1e9:      	nop
     1ea:      	movl	-0x4(%rbp), %eax
     1ed:      	cltq
     1ef:      	movzbl	-0x30(%rbp,%rax), %eax
     1f4:      	cmpb	$0x47, %al
     1f6:      	je	0x106 <main+0x106>
     1fc:      	jmp	0x3b3 <main+0x3b3>
     201:      	leaq	(%rip), %rax            # 0x208 <main+0x208>
		0000000000000204:  R_X86_64_PC32	.rodata+0x12
     208:      	movq	%rax, %rdi
     20b:      	callq	0x210 <main+0x210>
		000000000000020c:  R_X86_64_PLT32	puts-0x4
     210:      	jmp	0x3b3 <main+0x3b3>
     215:      	addl	$0x1, -0x4(%rbp)
     219:      	nop
     21a:      	movl	-0x4(%rbp), %eax
     21d:      	cltq
     21f:      	movzbl	-0x30(%rbp,%rax), %eax
     224:      	cmpb	$0x74, %al
     226:      	je	0x340 <main+0x340>
     22c:      	jmp	0x3b3 <main+0x3b3>
     231:      	addl	$0x1, -0x4(%rbp)
     235:      	nop
     236:      	movl	-0x4(%rbp), %eax
     239:      	cltq
     23b:      	movzbl	-0x30(%rbp,%rax), %eax
     240:      	cmpb	$0x72, %al
     242:      	jne	0x3a0 <main+0x3a0>
     248:      	addl	$0x1, -0x4(%rbp)
     24c:      	nop
     24d:      	movl	-0x4(%rbp), %eax
     250:      	cltq
     252:      	movzbl	-0x30(%rbp,%rax), %eax
     257:      	cmpb	$0x33, %al
     259:      	je	0xb7 <main+0xb7>
     25f:      	jmp	0x3b3 <main+0x3b3>
     264:      	addl	$0x1, -0x4(%rbp)
     268:      	nop
     269:      	movl	-0x4(%rbp), %eax
     26c:      	cltq
     26e:      	movzbl	-0x30(%rbp,%rax), %eax
     273:      	cmpb	$0x30, %al
     275:      	je	0x231 <main+0x231>
     277:      	jmp	0x3b3 <main+0x3b3>
     27c:      	addl	$0x1, -0x4(%rbp)
     280:      	nop
     281:      	movl	-0x4(%rbp), %eax
     284:      	cltq
     286:      	movzbl	-0x30(%rbp,%rax), %eax
     28b:      	cmpb	$0x5f, %al
     28d:      	jne	0x3a3 <main+0x3a3>
     293:      	addl	$0x1, -0x4(%rbp)
     297:      	nop
     298:      	movl	-0x4(%rbp), %eax
     29b:      	cltq
     29d:      	movzbl	-0x30(%rbp,%rax), %eax
     2a2:      	cmpb	$0x39, %al
     2a4:      	jne	0x3a6 <main+0x3a6>
     2aa:      	addl	$0x1, -0x4(%rbp)
     2ae:      	nop
     2af:      	movl	-0x4(%rbp), %eax
     2b2:      	cltq
     2b4:      	movzbl	-0x30(%rbp,%rax), %eax
     2b9:      	cmpb	$0x30, %al
     2bb:      	je	0x215 <main+0x215>
     2c1:      	jmp	0x3b3 <main+0x3b3>
     2c6:      	addl	$0x1, -0x4(%rbp)
     2ca:      	nop
     2cb:      	movl	-0x4(%rbp), %eax
     2ce:      	cltq
     2d0:      	movzbl	-0x30(%rbp,%rax), %eax
     2d5:      	cmpb	$0x39, %al
     2d7:      	jne	0x3a9 <main+0x3a9>
     2dd:      	addl	$0x1, -0x4(%rbp)
     2e1:      	nop
     2e2:      	movl	-0x4(%rbp), %eax
     2e5:      	cltq
     2e7:      	movzbl	-0x30(%rbp,%rax), %eax
     2ec:      	cmpb	$0x30, %al
     2ee:      	jne	0x3ac <main+0x3ac>
     2f4:      	addl	$0x1, -0x4(%rbp)
     2f8:      	nop
     2f9:      	movl	-0x4(%rbp), %eax
     2fc:      	cltq
     2fe:      	movzbl	-0x30(%rbp,%rax), %eax
     303:      	cmpb	$0x74, %al
     305:      	jne	0x3af <main+0x3af>
     30b:      	addl	$0x1, -0x4(%rbp)
     30f:      	nop
     310:      	movl	-0x4(%rbp), %eax
     313:      	cltq
     315:      	movzbl	-0x30(%rbp,%rax), %eax
     31a:      	cmpb	$0x30, %al
     31c:      	je	0x1b1 <main+0x1b1>
     322:      	jmp	0x3b3 <main+0x3b3>
     327:      	addl	$0x1, -0x4(%rbp)
     32b:      	nop
     32c:      	movl	-0x4(%rbp), %eax
     32f:      	cltq
     331:      	movzbl	-0x30(%rbp,%rax), %eax
     336:      	cmpb	$0x66, %al
     338:      	je	0xd3 <main+0xd3>
     33e:      	jmp	0x3b3 <main+0x3b3>
     340:      	addl	$0x1, -0x4(%rbp)
     344:      	nop
     345:      	movl	-0x4(%rbp), %eax
     348:      	cltq
     34a:      	movzbl	-0x30(%rbp,%rax), %eax
     34f:      	cmpb	$0x30, %al
     351:      	je	0x150 <main+0x150>
     357:      	jmp	0x3b3 <main+0x3b3>
     359:      	addl	$0x1, -0x4(%rbp)
     35d:      	nop
     35e:      	movl	-0x4(%rbp), %eax
     361:      	cltq
     363:      	movzbl	-0x30(%rbp,%rax), %eax
     368:      	cmpb	$0x7b, %al
     36a:      	jne	0x3b2 <main+0x3b2>
     36c:      	addl	$0x1, -0x4(%rbp)
     370:      	nop
     371:      	movl	-0x4(%rbp), %eax
     374:      	cltq
     376:      	movzbl	-0x30(%rbp,%rax), %eax
     37b:      	cmpb	$0x47, %al
     37d:      	je	0x56 <main+0x56>
     383:      	jmp	0x3b3 <main+0x3b3>
     385:      	nop
     386:      	jmp	0x3b3 <main+0x3b3>
     388:      	nop
     389:      	jmp	0x3b3 <main+0x3b3>
     38b:      	nop
     38c:      	jmp	0x3b3 <main+0x3b3>
     38e:      	nop
     38f:      	jmp	0x3b3 <main+0x3b3>
     391:      	nop
     392:      	jmp	0x3b3 <main+0x3b3>
     394:      	nop
     395:      	jmp	0x3b3 <main+0x3b3>
     397:      	nop
     398:      	jmp	0x3b3 <main+0x3b3>
     39a:      	nop
     39b:      	jmp	0x3b3 <main+0x3b3>
     39d:      	nop
     39e:      	jmp	0x3b3 <main+0x3b3>
     3a0:      	nop
     3a1:      	jmp	0x3b3 <main+0x3b3>
     3a3:      	nop
     3a4:      	jmp	0x3b3 <main+0x3b3>
     3a6:      	nop
     3a7:      	jmp	0x3b3 <main+0x3b3>
     3a9:      	nop
     3aa:      	jmp	0x3b3 <main+0x3b3>
     3ac:      	nop
     3ad:      	jmp	0x3b3 <main+0x3b3>
     3af:      	nop
     3b0:      	jmp	0x3b3 <main+0x3b3>
     3b2:      	nop
     3b3:      	leave
     3b4:      	retq`;

	function parseCode() {
		dispatch('parse', { code: inputCode });
	}

	function loadSample() {
		inputCode = sampleCode;
		parseCode();
	}

	function clearCode() {
		inputCode = '';
		dispatch('clear');
	}

	function toggleBreakpoint(lineIndex: number) {
		dispatch('toggleBreakpoint', { line: lineIndex });
	}

	function jumpToLine(lineIndex: number) {
		dispatch('jumpTo', { line: lineIndex });
	}

	// オペコードツールチップ表示
	function showOpcodeTooltip(event: MouseEvent, opcode: string) {
		const doc = getFullDescription(opcode);
		if (!doc) return;

		tooltip = {
			visible: true,
			x: event.clientX + 10,
			y: event.clientY - 10,
			content: doc,
			type: 'opcode'
		};
	}

	// レジスタツールチップ表示
	function showRegisterTooltip(event: MouseEvent, operand: string) {
		if (!isRegister(operand)) return;

		const doc = getRegisterFullDescription(operand);
		if (!doc) return;

		tooltip = {
			visible: true,
			x: event.clientX + 10,
			y: event.clientY - 10,
			content: doc,
			type: 'register'
		};
	}

	// ツールチップ非表示
	function hideTooltip() {
		tooltip.visible = false;
	}

	// シンタックスハイライト用のクラス取得
	function getInstructionClass(instruction: AssemblyLine): string {
		const mnemonic = instruction.mnemonic.toLowerCase();

		if (['jmp', 'je', 'jne', 'js', 'jns', 'jz', 'jnz', 'callq', 'retq'].includes(mnemonic)) {
			return 'text-purple-700 font-semibold'; // 分岐・関数呼び出し
		} else if (['movq', 'movl', 'leaq', 'movzbl'].includes(mnemonic)) {
			return 'text-blue-700'; // データ移動
		} else if (['pushq', 'popq', 'subq', 'addl'].includes(mnemonic)) {
			return 'text-green-700'; // スタック操作
		} else if (['cmpb', 'cltq'].includes(mnemonic)) {
			return 'text-orange-700'; // 比較・変換
		}
		return 'text-gray-700'; // その他
	}

	function getOperandClass(operand: string): string {
		if (operand.startsWith('%')) {
			return 'text-blue-600 font-medium'; // レジスタ
		} else if (operand.startsWith('$')) {
			return 'text-green-600'; // 即値
		} else if (operand.includes('(') && operand.includes(')')) {
			return 'text-purple-600'; // メモリアドレス
		}
		return 'text-gray-600'; // その他
	}
</script>

<div class="code-panel space-y-4">
	<!-- コード入力セクション -->
	<div class="code-input">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">アセンブリコード</h2>
			<div class="flex space-x-2">
				<button
					class="flex items-center text-sm text-blue-600 hover:text-blue-800"
					on:click={loadSample}
				>
					<Icon icon="mdi:file-document" class="mr-1" />
					サンプル
				</button>
				<button
					class="flex items-center text-sm text-gray-600 hover:text-gray-800"
					on:click={clearCode}
				>
					<Icon icon="mdi:close" class="mr-1" />
					クリア
				</button>
			</div>
		</div>

		<textarea
			bind:value={inputCode}
			rows="12"
			placeholder="objdump形式のアセンブリコードを貼り付けてください...&#10;&#10;例:&#10;0000000000000000 <main>:&#10;       0: 55                               pushq    %rbp&#10;       1: 48 89 e5                         movq    %rsp, %rbp"
			class="w-full resize-none rounded border border-gray-300 bg-gray-50 p-3 font-mono text-sm"
		></textarea>

		<div class="mt-2 flex items-center justify-between">
			<div class="text-sm text-gray-500">
				{#if inputCode}
					{inputCode.split('\n').length} 行のコード
				{:else}
					コードが入力されていません
				{/if}
			</div>
			<button
				class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={!inputCode.trim()}
				on:click={parseCode}
			>
				解析実行
			</button>
		</div>
	</div>

	<!-- 解析されたコード表示 -->
	{#if instructions.length > 0}
		<div class="parsed-code">
			<h3 class="text-md mb-2 font-medium">解析結果 ({instructions.length} 命令)</h3>

			<div class="code-content max-h-96 overflow-y-auto rounded border border-gray-300">
				{#each instructions as instruction, index}
					<div
						class="code-line flex items-center hover:bg-gray-50 {index === currentPC
							? 'border-l-4 border-blue-500 bg-blue-100'
							: ''} {breakpoints.has(index) ? 'border-r-4 border-red-500 bg-red-50' : ''}"
						on:dblclick={() => jumpToLine(index)}
					>
						<!-- 行番号 -->
						<div class="line-number w-12 py-1 text-center text-xs text-gray-400">
							{index}
						</div>

						<!-- ブレークポイント -->
						<div class="breakpoint w-6 text-center">
							<button
								class="h-4 w-4 rounded-full border border-gray-300 {breakpoints.has(index)
									? 'bg-red-500'
									: 'bg-white'} hover:bg-red-200"
								on:click={() => toggleBreakpoint(index)}
							>
								{#if breakpoints.has(index)}
									<span class="text-xs text-white">●</span>
								{/if}
							</button>
						</div>

						<!-- 現在実行行マーカー -->
						<div class="pc-marker w-6 text-center">
							{#if index === currentPC}
								<Icon icon="mdi:play" class="h-4 w-4 text-blue-600" />
							{/if}
						</div>

						<!-- アドレス -->
						<div class="address w-20 py-1 font-mono text-xs text-gray-500">
							{instruction.address}
						</div>

						<!-- バイトコード -->
						<div class="bytes w-32 truncate py-1 font-mono text-xs text-gray-400">
							{instruction.bytes}
						</div>

						<!-- 命令 -->
						<div class="instruction flex-1 py-1 font-mono text-sm">
							<span
								class="{getInstructionClass(
									instruction
								)} -mx-1 cursor-help px-1 hover:rounded hover:bg-blue-100"
								on:mouseenter={(e) => showOpcodeTooltip(e, instruction.mnemonic)}
								on:mouseleave={hideTooltip}
								role="button"
								tabindex="0"
								title="クリックして詳細を表示"
							>
								{instruction.mnemonic}
							</span>
							{#if instruction.operands.length > 0}
								<span class="ml-2">
									{#each instruction.operands as operand, i}
										{#if i > 0}<span class="text-gray-500">, </span>{/if}
										<span
											class="{getOperandClass(operand)} {isRegister(operand)
												? '-mx-1 cursor-help px-1 hover:rounded hover:bg-blue-100'
												: ''}"
											on:mouseenter={(e) => {
												if (isRegister(operand)) {
													showRegisterTooltip(e, operand);
												}
											}}
											on:mouseleave={hideTooltip}
											role={isRegister(operand) ? 'button' : undefined}
											tabindex={isRegister(operand) ? 0 : undefined}
											title={isRegister(operand) ? 'クリックして詳細を表示' : undefined}
											>{operand}</span
										>
									{/each}
								</span>
							{/if}

							{#if instruction.comment}
								<span class="ml-2 text-xs text-green-600">{instruction.comment}</span>
							{/if}

							{#if instruction.relocation}
								<span class="ml-2 text-xs text-purple-600 font-medium">
									→ {instruction.relocation.symbol}
									{#if instruction.relocation.addend}
										{instruction.relocation.addend}
									{/if}
									<span class="text-purple-400">({instruction.relocation.type})</span>
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- 凡例 -->
			<div class="legend mt-2 text-xs text-gray-500">
				<div class="flex flex-wrap gap-x-4 gap-y-1">
					<span>🔵 現在実行中</span>
					<span>🔴 ブレークポイント</span>
					<span class="text-purple-600">→ 関数呼び出し</span>
					<span>ダブルクリックで該当行にジャンプ</span>
				</div>
			</div>
		</div>
	{:else if inputCode.trim()}
		<div class="py-8 text-center text-gray-500">
			「解析実行」ボタンを押してコードを解析してください
		</div>
	{/if}
</div>

<!-- ツールチップ -->
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
			{#if tooltip.type === 'opcode' && 'syntax' in tooltip.content}
				<div>
					<div class="font-semibold text-yellow-300">構文:</div>
					<div class="rounded bg-gray-800 p-1 font-mono">{tooltip.content.syntax}</div>
				</div>

				<div>
					<div class="font-semibold text-yellow-300">引数:</div>
					<div class="whitespace-pre-line text-gray-200">{tooltip.content.operands}</div>
				</div>

				<div>
					<div class="font-semibold text-yellow-300">動作:</div>
					<div class="whitespace-pre-line text-gray-200">{tooltip.content.operation}</div>
				</div>

				<div>
					<div class="font-semibold text-yellow-300">フラグ:</div>
					<div class="text-gray-300">{tooltip.content.flags}</div>
				</div>
			{:else if tooltip.type === 'register' && 'size' in tooltip.content}
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

				{#if tooltip.content.notes}
					<div>
						<div class="font-semibold text-yellow-300">注意:</div>
						<div class="text-gray-300">{tooltip.content.notes}</div>
					</div>
				{/if}
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
		</div>
	</div>
{/if}

<style>
	.code-panel {
		border-radius: 0.5rem;
		border: 1px solid #d1d5db;
		padding: 1rem;
		background-color: white;
		max-height: 700px;
		overflow-y: auto;
	}

	.code-line {
		border-bottom: 1px solid #f3f4f6;
		transition: background-color 0.2s;
	}

	.code-line:last-child {
		border-bottom: none;
	}

	.code-line:hover {
		cursor: pointer;
	}

	.legend {
		border-top: 1px solid #e5e7eb;
		padding-top: 0.5rem;
	}
</style>
