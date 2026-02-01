<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	const tool = tools.find((t) => t.name === 'ctf-cipher');

	// 暗号解読結果の型
	interface DecryptResult {
		cipher: string;
		result: string;
		confidence: number; // 0-100
		detail?: string;
	}

	interface DecryptGroup {
		cipher: string;
		results: DecryptResult[];
		maxConfidence: number;
	}

	// 状態管理
	let inputText = $state('');
	let decryptGroups = $state<DecryptGroup[]>([]);
	let errorMessage = $state('');
	let isAnalyzing = $state(false);

	const CIPHER_BONUS: Record<string, number> = {
		Base64: 8,
		Reverse: 5,
		'Rail Fence': 5
	};

	function applyCipherBonus(result: DecryptResult): DecryptResult {
		const bonus = CIPHER_BONUS[result.cipher] ?? 0;
		if (bonus <= 0) return result;
		return {
			...result,
			confidence: result.confidence + bonus
		};
	}

	// Caesar cipher（全26パターン）
	function decryptCaesar(text: string): DecryptResult[] {
		const results: DecryptResult[] = [];

		for (let shift = 1; shift < 26; shift++) {
			const decrypted = text.replace(/[a-zA-Z]/g, (char) => {
				const base = char <= 'Z' ? 65 : 97;
				return String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
			});

			// 変化がある場合のみ追加
			if (decrypted !== text) {
				const confidence = calculateGeneralConfidence(decrypted);
				results.push(
					applyCipherBonus({
						cipher: 'Caesar cipher',
						result: decrypted,
						confidence,
						detail: `Shift: ${shift}`
					})
				);
			}
		}

		return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5); // 上位5件
	}

	const COMMON_WORD_LIST = [
		'the',
		'be',
		'to',
		'of',
		'and',
		'a',
		'in',
		'that',
		'have',
		'i',
		'it',
		'for',
		'not',
		'on',
		'with',
		'he',
		'as',
		'you',
		'do',
		'at',
		'this',
		'but',
		'his',
		'by',
		'from',
		'they',
		'we',
		'say',
		'her',
		'she',
		'or',
		'an',
		'will',
		'my',
		'one',
		'all',
		'would',
		'there',
		'their',
		'what',
		'so',
		'up',
		'out',
		'if',
		'about',
		'who',
		'get',
		'which',
		'go',
		'me',
		'when',
		'make',
		'can',
		'like',
		'time',
		'no',
		'just',
		'him',
		'know',
		'take',
		'people',
		'into',
		'year',
		'your',
		'good',
		'some',
		'could',
		'them',
		'see',
		'other',
		'than',
		'then',
		'now',
		'look',
		'only',
		'come',
		'its',
		'over',
		'think',
		'also',
		'back',
		'after',
		'use',
		'two',
		'how',
		'our',
		'work',
		'first',
		'well',
		'way',
		'even',
		'new',
		'want',
		'because',
		'any',
		'these',
		'give',
		'day',
		'most',
		'us',
		'flag',
		'flags',
		'hint',
		'hints',
		'ctf',
		'crypto',
		'cipher',
		'decode',
		'decode',
		'encoded',
		'plain',
		'plaintext',
		'key',
		'keys',
		'challenge',
		'challenges',
		'solve',
		'solved',
		'answer',
		'answers',
		'check',
		'verify',
		'submit',
		'submitted'
	];

	const COMMON_WORDS = new Map(
		COMMON_WORD_LIST.map((word, index) => [word, 1 - index / COMMON_WORD_LIST.length])
	);

	const ENGLISH_BIGRAMS = [
		'th',
		'he',
		'in',
		'er',
		'an',
		're',
		'on',
		'at',
		'en',
		'nd',
		'ti',
		'es',
		'or',
		'te',
		'of',
		'ed',
		'is',
		'it',
		'al',
		'ar',
		'st',
		'to',
		'nt',
		'ng',
		'se',
		'ha',
		'as',
		'ou',
		'io',
		'le'
	];

	// ROT47（ASCII 33-126）
	function decryptROT47(text: string): DecryptResult {
		const decrypted = text.replace(/[!-~]/g, (char) => {
			const code = char.charCodeAt(0);
			return String.fromCharCode(33 + ((code - 33 + 47) % 94));
		});

		return applyCipherBonus({
			cipher: 'ROT47',
			result: decrypted,
			confidence: calculateGeneralConfidence(decrypted)
		});
	}

	// Atbash cipher（A↔Z, B↔Y, ...）
	function decryptAtbash(text: string): DecryptResult {
		const decrypted = text.replace(/[a-zA-Z]/g, (char) => {
			const base = char <= 'Z' ? 65 : 97;
			return String.fromCharCode(25 - (char.charCodeAt(0) - base) + base);
		});

		return applyCipherBonus({
			cipher: 'Atbash cipher',
			result: decrypted,
			confidence: calculateGeneralConfidence(decrypted)
		});
	}

	// XOR single-byte brute force
	function decryptXOR(text: string): DecryptResult[] {
		const results: DecryptResult[] = [];
		const bytes = new TextEncoder().encode(text);
		const decoder = new TextDecoder('utf-8', { fatal: true });

		for (let key = 1; key < 256; key++) {
			try {
				const decrypted = bytes.map((b) => b ^ key);
				const decoded = decoder.decode(decrypted);

				// 印字可能文字のみかチェック
				if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
					const confidence = calculateGeneralConfidence(decoded);
					if (confidence > 20) {
						results.push(
							applyCipherBonus({
								cipher: 'XOR',
								result: decoded,
								confidence,
								detail: `Key: 0x${key.toString(16).padStart(2, '0').toUpperCase()} (${key})`
							})
						);
					}
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		return results.sort((a, b) => b.confidence - a.confidence).slice(0, 10); // 上位10件
	}

	// Base64多段デコード
	function decryptBase64Multi(text: string): DecryptResult[] {
		const results: DecryptResult[] = [];
		const seen = new SvelteSet<string>([text.trim()]);
		let current = text.trim();
		let depth = 0;

		while (depth < 10) {
			// Base64形式かチェック（パディングは最大2個まで）
			if (!/^[A-Za-z0-9+/]+={0,2}$/.test(current) || current.length % 4 !== 0) {
				break;
			}

			try {
				const binaryStr = atob(current);
				const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
				const decoded = new TextDecoder('utf-8').decode(bytes);

				depth++;

				// 循環検出
				if (seen.has(decoded)) {
					break;
				}

				seen.add(decoded);
				const confidence = calculateGeneralConfidence(decoded);
				results.push(
					applyCipherBonus({
						cipher: 'Base64',
						result: decoded,
						confidence,
						detail: `${depth}回デコード`
					})
				);

				current = decoded.trim();
			} catch {
				break;
			}
		}

		return results;
	}

	// Reverse（逆順）
	function decryptReverse(text: string): DecryptResult {
		const reversed = text.split('').reverse().join('');

		return applyCipherBonus({
			cipher: 'Reverse',
			result: reversed,
			confidence: calculateGeneralConfidence(reversed)
		});
	}

	// Rail Fence cipher（レール数2-5）
	function decryptRailFence(text: string): DecryptResult[] {
		const results: DecryptResult[] = [];

		for (let rails = 2; rails <= 5; rails++) {
			try {
				const decrypted = railFenceDecrypt(text, rails);
				const confidence = calculateGeneralConfidence(decrypted);

				if (confidence > 20) {
					results.push(
						applyCipherBonus({
							cipher: 'Rail Fence',
							result: decrypted,
							confidence,
							detail: `Rails: ${rails}`
						})
					);
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		return results.sort((a, b) => b.confidence - a.confidence);
	}

	// Rail Fence復号化ヘルパー
	function railFenceDecrypt(ciphertext: string, rails: number): string {
		const len = ciphertext.length;
		const fence: (string | null)[][] = Array.from({ length: rails }, () => Array(len).fill(null));

		// まずジグザグパターンをマーク
		let rail = 0;
		let direction = 1;
		for (let i = 0; i < len; i++) {
			fence[rail][i] = '*'; // マーカー
			rail += direction;
			if (rail === 0 || rail === rails - 1) {
				direction *= -1;
			}
		}

		// 暗号文を各レールに配置
		let idx = 0;
		for (let r = 0; r < rails; r++) {
			for (let c = 0; c < len; c++) {
				if (fence[r][c] === '*') {
					fence[r][c] = ciphertext[idx++];
				}
			}
		}

		// ジグザグパターンで読み取り
		const result: string[] = [];
		rail = 0;
		direction = 1;
		for (let i = 0; i < len; i++) {
			const char = fence[rail][i];
			if (char === null) {
				throw new Error(`Unexpected null at rail ${rail}, position ${i}`);
			}
			result.push(char);
			rail += direction;
			if (rail === 0 || rail === rails - 1) {
				direction *= -1;
			}
		}

		return result.join('');
	}

	// 一般的な平文らしさを評価（0-100）
	function calculateGeneralConfidence(text: string): number {
		const len = text.length;
		if (len === 0) return 0;

		const printable = text.match(/[\x20-\x7E]/g)?.length || 0;
		const whitespace = text.match(/\s/g)?.length || 0;
		const letters = text.match(/[A-Za-z]/g)?.length || 0;
		const digits = text.match(/[0-9]/g)?.length || 0;
		const lettersDigits = letters + digits;
		const punctuation = text.match(/[.,;:'"!?()[\]{}<>/\\\-_=+@#$%^&*]/g)?.length || 0;
		const uniqueChars = new SvelteSet(text).size;
		const wordMatches = text.match(/[A-Za-z]{2,}/g) || [];
		const wordLikeCount = wordMatches.reduce((sum, word) => sum + word.length, 0);
		const avgWordLength =
			wordMatches.length > 0
				? wordMatches.reduce((sum, word) => sum + word.length, 0) / wordMatches.length
				: 0;
		const vowelCount = text.match(/[AEIOUaeiou]/g)?.length || 0;
		const entropy = calculateShannonEntropy(text);

		const printableRatio = printable / len;
		const whitespaceRatio = whitespace / len;
		const lettersDigitsRatio = lettersDigits / len;
		const punctuationRatio = punctuation / len;
		const diversityRatio = uniqueChars / len;
		const wordLikeRatio = wordLikeCount / len;
		const vowelRatio = letters > 0 ? vowelCount / letters : 0;
		const { wordHitRatio, wordWeightAvg } = calculateWordCommonness(text);
		const bigramRatio = calculateBigramRatio(text);

		let score = 0;
		score += printableRatio * 32;
		score += scoreInRange(whitespaceRatio, 0.05, 0.3, 11);
		score += scoreInRange(lettersDigitsRatio, 0.4, 0.95, 11);
		score += scoreInRange(punctuationRatio, 0.01, 0.18, 3);
		score += scoreInRange(diversityRatio, 0.2, 0.7, 7);
		score += scoreInRange(entropy, 3.2, 5.2, 10);
		score += scoreInRange(wordLikeRatio, 0.2, 0.8, 7);
		score += scoreInRange(avgWordLength, 3, 8, 5);
		if (letters > 0) {
			score += scoreInRange(vowelRatio, 0.2, 0.55, 5);
		}
		score += scoreInRange(wordHitRatio, 0.08, 0.4, 16);
		score += scoreInRange(wordWeightAvg, 0.2, 0.8, 7);
		score += scoreInRange(bigramRatio, 0.15, 0.55, 10);

		const maxRun = getMaxRunLength(text);
		if (maxRun > 8) {
			score -= (maxRun - 8) * 2;
		}

		const nonPrintableRatio = 1 - printableRatio;
		if (nonPrintableRatio > 0) {
			score -= nonPrintableRatio * 30;
		}

		const digitRatio = digits / len;
		if (digitRatio > 0.5 && lettersDigitsRatio < 0.7) {
			score -= (digitRatio - 0.5) * 20;
		}

		const nonWordRatio = 1 - (lettersDigits + whitespace) / len;
		if (nonWordRatio > 0.25) {
			score -= (nonWordRatio - 0.25) * 50;
		}

		if (punctuationRatio > 0.18) {
			score -= (punctuationRatio - 0.18) * 45;
		}

		const adjusted = 100 * Math.tanh(score / 110);
		return Math.max(0, Math.round(adjusted));
	}

	function scoreInRange(value: number, min: number, max: number, weight: number): number {
		if (value <= 0) return 0;
		if (value < min) return weight * (value / min);
		if (value > max) return weight * (1 - (value - max) / (1 - max));
		return weight;
	}

	function getMaxRunLength(text: string): number {
		let maxRun = 1;
		let currentRun = 1;
		for (let i = 1; i < text.length; i++) {
			if (text[i] === text[i - 1]) {
				currentRun += 1;
				if (currentRun > maxRun) maxRun = currentRun;
			} else {
				currentRun = 1;
			}
		}
		return maxRun;
	}

	function calculateShannonEntropy(text: string): number {
		const len = text.length;
		if (len === 0) return 0;
		const freq = new SvelteMap<string, number>();
		for (const char of text) {
			freq.set(char, (freq.get(char) || 0) + 1);
		}
		let entropy = 0;
		for (const count of freq.values()) {
			const p = count / len;
			entropy -= p * Math.log2(p);
		}
		return entropy;
	}

	function calculateWordCommonness(text: string): {
		wordHitRatio: number;
		wordWeightAvg: number;
	} {
		const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
		if (words.length === 0) return { wordHitRatio: 0, wordWeightAvg: 0 };
		let hitCount = 0;
		let weightSum = 0;
		for (const word of words) {
			const weight = COMMON_WORDS.get(word);
			if (weight !== undefined) {
				hitCount += 1;
				weightSum += weight;
			}
		}
		return {
			wordHitRatio: hitCount / words.length,
			wordWeightAvg: hitCount > 0 ? weightSum / hitCount : 0
		};
	}

	function calculateBigramRatio(text: string): number {
		const lettersOnly = text.toLowerCase().replace(/[^a-z]/g, '');
		if (lettersOnly.length < 2) return 0;
		let total = 0;
		let hits = 0;
		for (let i = 0; i < lettersOnly.length - 1; i++) {
			const bg = lettersOnly.slice(i, i + 2);
			total += 1;
			if (ENGLISH_BIGRAMS.includes(bg)) {
				hits += 1;
			}
		}
		return total > 0 ? hits / total : 0;
	}

	// 自動解読実行
	async function performDecrypt() {
		errorMessage = '';
		decryptGroups = [];

		if (!inputText.trim()) {
			errorMessage = '入力テキストを入力してください';
			return;
		}

		// 入力サイズ制限（1MB）
		const MAX_INPUT_SIZE = 1 * 1024 * 1024;
		if (inputText.length > MAX_INPUT_SIZE) {
			errorMessage = `入力が大きすぎます（最大: ${(MAX_INPUT_SIZE / 1024 / 1024).toFixed(0)}MB）`;
			return;
		}

		isAnalyzing = true;

		try {
			const allResults: DecryptResult[] = [];

			// Caesar cipher
			allResults.push(...decryptCaesar(inputText));
			await new Promise((resolve) => setTimeout(resolve, 0));

			// ROT47
			const rot47 = decryptROT47(inputText);
			if (rot47.confidence > 20) {
				allResults.push(rot47);
			}

			// Atbash
			const atbash = decryptAtbash(inputText);
			if (atbash.confidence > 20) {
				allResults.push(atbash);
			}

			// XOR（重い処理）
			allResults.push(...decryptXOR(inputText));
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Base64多段
			allResults.push(...decryptBase64Multi(inputText));

			// Reverse
			const reverse = decryptReverse(inputText);
			if (reverse.confidence > 20) {
				allResults.push(reverse);
			}

			// Rail Fence
			allResults.push(...decryptRailFence(inputText));
			await new Promise((resolve) => setTimeout(resolve, 0));

			// 信頼度でソート
			const grouped = new SvelteMap<string, DecryptResult[]>();
			for (const result of allResults) {
				const list = grouped.get(result.cipher) ?? [];
				list.push(result);
				grouped.set(result.cipher, list);
			}

			decryptGroups = Array.from(grouped.entries())
				.map(([cipher, results]) => {
					const sorted = results.sort((a, b) => b.confidence - a.confidence);
					return {
						cipher,
						results: sorted,
						maxConfidence: sorted[0]?.confidence ?? 0
					};
				})
				.sort((a, b) => b.maxConfidence - a.maxConfidence);

			if (decryptGroups.length === 0) {
				errorMessage = '有効な復号結果が見つかりませんでした';
			}
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = '解読に失敗しました';
			}
		} finally {
			isAnalyzing = false;
		}
	}

	// クリップボードコピー
	async function copyToClipboard(text: string) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// クリア
	function clear() {
		inputText = '';
		decryptGroups = [];
		errorMessage = '';
	}

	// サンプルデータ
	const samples: Record<string, { input: string; description: string }> = {
		caesar: {
			input: 'ZHOFRPH WR WKH VKLIW VKRZFDVH. WKLV PHVVDJH KDV PXOWLSOH VZDSV DQG D ORQJHU OHQJWK.',
			description: 'Caesar cipher (Shift 3)'
		},
		rot13: {
			input:
				'Guvf vf n ybatre fgevat gb grfg grkg yriryvat. Jr jnag gb frr ubj gur frpher srryvat orunirf.',
			description: 'ROT13'
		},
		atbash: {
			input: 'GSRH RH Z OLMTVI HZNKOV NVHHZTV ULI ZGYZHS DRGS IVZO DLIWH.',
			description: 'Atbash cipher'
		},
		xor: {
			input:
				'\x39\x05\x04\x1e\x4d\x35\x22\x3f\x4d\x1e\x0c\x00\x1d\x01\x08\x4d\x1e\x05\x02\x18\x01\x09\x4d\x09\x08\x0e\x02\x09\x08\x4d\x04\x03\x19\x02\x4d\x1f\x08\x0c\x09\x0c\x0f\x01\x08\x4d\x28\x03\x0a\x01\x04\x1e\x05\x4d\x19\x08\x15\x19\x4d\x1a\x04\x19\x05\x4d\x0c\x4d\x0e\x01\x08\x0c\x1f\x4d\x00\x08\x0c\x03\x04\x03\x0a\x43',
			description: 'XOR (Key: 0x6D)'
		},
		base64: {
			input: 'U0dWc2JHOGdWMjl5YkdRPQ==',
			description: 'Base64（2回デコード）'
		},
		rail: {
			input: 'WECRLTEERDSOEEFEAOCAIVDEN',
			description: 'Rail Fence（レール数想定）'
		},
		reverse: {
			input: '.esrever ni nwod edispu eb dluow ti ,txet gnol a si sihT',
			description: 'Reverse'
		}
	};

	let sampleKey = $state('caesar');

	async function loadSample() {
		inputText = samples[sampleKey].input;
		await performDecrypt();
	}

	function totalResultsCount() {
		return decryptGroups.reduce((sum, group) => sum + group.results.length, 0);
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 説明 -->
	<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:information" class="mr-2 h-5 w-5 text-blue-600" />
			<h3 class="font-medium text-blue-900">このツールについて</h3>
		</div>
		<div class="space-y-1 text-sm text-blue-700">
			<p>簡易暗号を自動解読し、候補を可能性順に整理して表示します</p>
			<p>
				• 対応暗号: Caesar（全シフト）、ROT13/ROT47、Atbash、XOR、Base64多段、Reverse、Rail Fence
			</p>
			<p>• 一般的な指標で平文らしさを判定し、暗号方式ごとにまとめて表示</p>
		</div>
	</div>

	<!-- サンプル選択 -->
	<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center">
			<Icon icon="mdi:flask" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">サンプルデータ</h3>
		</div>
		<div class="flex gap-2">
			<select id="sample" bind:value={sampleKey} class="flex-1 rounded border border-gray-300 p-2">
				{#each Object.entries(samples) as [key, sample] (key)}
					<option value={key}>{sample.description}</option>
				{/each}
			</select>
			<button
				onclick={loadSample}
				class="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
			>
				<Icon icon="mdi:file-document-outline" class="mr-1 inline h-4 w-4" />
				読込
			</button>
		</div>
	</div>

	<!-- アクションボタン -->
	<div class="mb-4 flex items-center justify-center gap-3">
		<button
			onclick={performDecrypt}
			disabled={!inputText || isAnalyzing}
			class="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
		>
			{#if isAnalyzing}
				<Icon icon="mdi:loading" class="mr-2 inline h-4 w-4 animate-spin" />
				解析中...
			{:else}
				<Icon icon="mdi:lock-open" class="mr-2 inline h-4 w-4" />
				自動解読
			{/if}
		</button>
		<button onclick={clear} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
			<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
			クリア
		</button>
	</div>

	<!-- 入力エリア -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="font-medium text-gray-900">入力（暗号化されたテキスト）</h3>
			<div class="text-xs text-gray-500">
				{inputText.length.toLocaleString()} 文字
			</div>
		</div>
		<textarea
			bind:value={inputText}
			placeholder="暗号化されたテキストを入力してください..."
			class="h-32 w-full rounded border border-gray-300 p-3 font-mono text-sm"
		></textarea>
	</div>

	<!-- エラーメッセージ -->
	{#if errorMessage}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<Icon icon="mdi:alert-circle" class="mr-2 h-5 w-5 text-red-600" />
				<span class="font-medium text-red-900">エラー</span>
			</div>
			<p class="mt-1 text-sm text-red-700">{errorMessage}</p>
		</div>
	{/if}

	<!-- 解読結果 -->
	{#if decryptGroups.length > 0}
		<div class="space-y-6">
			<h3 class="text-lg font-medium text-gray-900">
				解読結果 ({totalResultsCount()}件 / {decryptGroups.length}方式)
			</h3>

			{#each decryptGroups as group, groupIndex (`${group.cipher}-${groupIndex}`)}
				<div class="rounded-lg border border-gray-200 bg-white p-4">
					<div class="mb-3 flex items-center gap-2">
						<Icon
							icon={groupIndex === 0 ? 'mdi:check-circle' : 'mdi:information'}
							class="h-5 w-5 {groupIndex === 0 ? 'text-green-600' : 'text-gray-600'}"
						/>
						<span class="font-medium text-gray-900">{group.cipher}</span>
						<span class="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
							>最高信頼度: {group.maxConfidence}%</span
						>
						{#if groupIndex === 0}
							<span class="rounded bg-green-200 px-2 py-1 text-xs font-medium text-green-800"
								>最有力</span
							>
						{/if}
					</div>

					<div class="space-y-3">
						{#each group.results as result, index (`${group.cipher}-${result.detail}-${index}`)}
							<div class="rounded border border-gray-100 bg-gray-50 p-3">
								<div class="mb-2 flex items-center justify-between">
									<div class="flex items-center gap-2">
										{#if result.detail}
											<span class="text-xs text-gray-500">({result.detail})</span>
										{/if}
										<span class="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
											>信頼度: {result.confidence}%</span
										>
									</div>
									<button
										onclick={() => copyToClipboard(result.result)}
										class="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
									>
										<Icon icon="mdi:content-copy" class="mr-1 inline h-3 w-3" />
										コピー
									</button>
								</div>
								<div class="rounded bg-white p-3">
									<pre class="font-mono text-sm break-all whitespace-pre-wrap">{result.result}</pre>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- 使い方ガイド -->
	<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:lightbulb-outline" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">使い方</h3>
		</div>
		<div class="space-y-2 text-sm text-gray-600">
			<p>• <strong>自動解読</strong>: すべての暗号方式を試行し、最も可能性の高い結果を表示</p>
			<p>
				• <strong>信頼度スコア</strong>:
				印字可能性・文字種の比率・エントロピーなどから、平文らしさを0-100で評価
			</p>
			<p>• <strong>複数候補</strong>: 暗号方式ごとに信頼度の高い順に候補を表示</p>
			<p>• <strong>方式対応</strong>: Caesar全シフト、XOR brute force、多段Base64に対応</p>
		</div>
	</div>

	<!-- 対応暗号一覧 -->
	<div class="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:shield-key" class="mr-2 h-5 w-5 text-purple-600" />
			<h3 class="font-medium text-purple-900">対応暗号方式</h3>
		</div>
		<div class="grid gap-2 text-sm text-purple-700 md:grid-cols-2">
			<div>• Caesar cipher（全26シフトパターン）</div>
			<div>• ROT13 / ROT47</div>
			<div>• Atbash cipher</div>
			<div>• XOR single-byte（0x00-0xFF総当たり）</div>
			<div>• Base64多段デコード（最大10回）</div>
			<div>• Reverse（文字列反転）</div>
			<div>• Rail Fence cipher（2-5レール）</div>
		</div>
	</div>
</div>
