<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'string-decoder');

	// エンコード形式の定義
	type EncodingFormat =
		| 'auto'
		| 'url'
		| 'html-entity'
		| 'base64'
		| 'unicode-js'
		| 'unicode-css'
		| 'unicode-codepoint'
		| 'hex-js'
		| 'octal-js'
		| 'json-string'
		| 'punycode'
		| 'base58'
		| 'rot13'
		| 'binary'
		| 'octal-num'
		| 'decimal'
		| 'hex-num'
		| 'morse'
		| 'quoted-printable'
		| 'uuencode';

	// デコード結果の型
	interface DecodeResult {
		format: string;
		result: string;
		confidence: number; // 0-100
	}

	// 状態管理
	let inputText = $state('');
	let selectedFormat: EncodingFormat = $state('auto');
	let decodeResults = $state<DecodeResult[]>([]);
	let errorMessage = $state('');

	// エンコード形式の情報
	const formatInfo: Record<
		EncodingFormat,
		{ label: string; description: string; example: string }
	> = {
		auto: {
			label: '自動検出',
			description: '入力から形式を自動推定してデコード',
			example: ''
		},
		url: {
			label: 'URLエンコード (%XX)',
			description: 'パーセントエンコーディング',
			example: '%E3%81%82%E3%81%84%E3%81%86 → あいう'
		},
		'html-entity': {
			label: 'HTMLエンティティ',
			description: '数値・名前付き文字参照',
			example: '&lt;div&gt;&#12354;&#x3044; → <div>あい'
		},
		base64: {
			label: 'Base64',
			description: 'Base64エンコード',
			example: 'SGVsbG8gV29ybGQ= → Hello World'
		},
		'unicode-js': {
			label: 'Unicode エスケープ (\\uHHHH)',
			description: 'JavaScript/JSON形式',
			example: '\\u3042\\u3044\\u3046 → あいう'
		},
		'unicode-css': {
			label: 'CSS Unicode (\\HHHHHH)',
			description: 'CSS形式のUnicodeエスケープ',
			example: '\\3042\\3044\\3046 → あいう'
		},
		'unicode-codepoint': {
			label: 'Unicode コードポイント (\\u{...})',
			description: 'ES6形式',
			example: '\\u{3042}\\u{3044} → あい'
		},
		'hex-js': {
			label: '16進数エスケープ (\\xHH)',
			description: 'JavaScript形式',
			example: '\\x41\\x42\\x43 → ABC'
		},
		'octal-js': {
			label: '8進数エスケープ (\\NNN)',
			description: 'JavaScript形式（レガシー）',
			example: '\\101\\102\\103 → ABC'
		},
		'json-string': {
			label: 'JSON文字列',
			description: 'JSON文字列リテラル',
			example: '"Hello\\nWorld" → Hello\nWorld'
		},
		punycode: {
			label: 'Punycode',
			description: '国際化ドメイン名',
			example: 'xn--wgv71a119e → 日本'
		},
		base58: {
			label: 'Base58',
			description: 'Bitcoin等で使用',
			example: '5Kd3... → バイナリ'
		},
		rot13: {
			label: 'ROT13',
			description: '簡易暗号（A↔N等）',
			example: 'Uryyb Jbeyq → Hello World'
		},
		binary: {
			label: '2進数',
			description: 'バイナリ表記',
			example: '01001000 01101001 → Hi'
		},
		'octal-num': {
			label: '8進数',
			description: '8進数表記',
			example: '110 145 154 154 157 → Hello'
		},
		decimal: {
			label: '10進数',
			description: '文字コードの10進数',
			example: '72 101 108 108 111 → Hello'
		},
		'hex-num': {
			label: '16進数',
			description: '16進数表記',
			example: '48 65 6C 6C 6F → Hello'
		},
		morse: {
			label: 'Morse Code',
			description: 'モールス信号',
			example: '.... . .-.. .-.. --- → HELLO'
		},
		'quoted-printable': {
			label: 'Quoted-Printable',
			description: 'メール用エンコード',
			example: 'Hello=20World → Hello World'
		},
		uuencode: {
			label: 'UUencode',
			description: 'UNIX形式',
			example: 'begin 644 file\n...\nend'
		}
	};

	// デコード処理関数群

	function decodeURL(text: string): string {
		try {
			return decodeURIComponent(text);
		} catch {
			throw new Error('URLデコードに失敗');
		}
	}

	function decodeHTMLEntity(text: string): string {
		let decoded = text;

		// 数値文字参照（10進数）
		decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));

		// 数値文字参照（16進数）
		decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
			String.fromCharCode(parseInt(hex, 16))
		);

		// 名前付き文字参照
		const entityMap: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#39;': "'",
			'&#x27;': "'",
			'&apos;': "'",
			'&#x2F;': '/',
			'&#x60;': '`',
			'&#x3D;': '=',
			'&nbsp;': '\u00A0',
			'&copy;': '©',
			'&reg;': '®',
			'&trade;': '™'
		};

		for (const [entity, char] of Object.entries(entityMap)) {
			decoded = decoded.replaceAll(entity, char);
		}

		return decoded;
	}

	function decodeBase64(text: string): string {
		try {
			return atob(text.trim());
		} catch {
			throw new Error('Base64デコードに失敗');
		}
	}

	function decodeUnicodeJS(text: string): string {
		// \uHHHH 形式
		return text.replace(/\\u([a-fA-F0-9]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
	}

	function decodeUnicodeCSS(text: string): string {
		// \HHHHHH 形式（1-6桁の16進数）
		return text.replace(/\\([a-fA-F0-9]{1,6})(?:\s|$|(?=[^a-fA-F0-9]))/g, (_, hex) =>
			String.fromCodePoint(parseInt(hex, 16))
		);
	}

	function decodeUnicodeCodePoint(text: string): string {
		// \u{HHHHHH} 形式
		return text.replace(/\\u\{([a-fA-F0-9]+)\}/g, (_, hex) =>
			String.fromCodePoint(parseInt(hex, 16))
		);
	}

	function decodeHexJS(text: string): string {
		// \xHH 形式
		return text.replace(/\\x([a-fA-F0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
	}

	function decodeOctalJS(text: string): string {
		// \NNN 形式（1-3桁の8進数）
		return text.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
	}

	function decodeJSONString(text: string): string {
		try {
			// JSON文字列としてパース
			return JSON.parse(text);
		} catch {
			throw new Error('JSON文字列のデコードに失敗');
		}
	}

	function decodePunycode(text: string): string {
		// 簡易的なPunycodeデコード（完全な実装ではない）
		try {
			if (!text.startsWith('xn--')) {
				throw new Error('Punycode形式ではありません');
			}
			// ブラウザのURL APIを利用
			const url = new URL(`http://${text}`);
			return url.hostname;
		} catch {
			throw new Error('Punycodeデコードに失敗');
		}
	}

	function decodeBase58(text: string): string {
		// Base58のアルファベット（Bitcoin形式）
		const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

		let result = 0n;
		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const value = alphabet.indexOf(char);
			if (value === -1) {
				throw new Error('無効なBase58文字');
			}
			result = result * 58n + BigInt(value);
		}

		// 16進数文字列として返す
		return '0x' + result.toString(16);
	}

	function decodeROT13(text: string): string {
		return text.replace(/[a-zA-Z]/g, (char) => {
			const base = char <= 'Z' ? 65 : 97;
			return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
		});
	}

	function decodeBinary(text: string): string {
		// 8ビットずつ区切って変換
		const bytes = text.match(/[01]{8}/g);
		if (!bytes) {
			throw new Error('8ビット単位のバイナリではありません');
		}
		return bytes.map((b) => String.fromCharCode(parseInt(b, 2))).join('');
	}

	function decodeOctalNum(text: string): string {
		// スペース区切りの8進数
		const nums = text.trim().split(/\s+/);
		return nums.map((n) => String.fromCharCode(parseInt(n, 8))).join('');
	}

	function decodeDecimal(text: string): string {
		// スペース区切りの10進数
		const nums = text.trim().split(/\s+/);
		return nums.map((n) => String.fromCharCode(parseInt(n, 10))).join('');
	}

	function decodeHexNum(text: string): string {
		// スペース区切りの16進数
		const nums = text.trim().split(/\s+/);
		return nums.map((n) => String.fromCharCode(parseInt(n, 16))).join('');
	}

	function decodeMorse(text: string): string {
		const morseToChar: Record<string, string> = {
			'.-': 'A',
			'-...': 'B',
			'-.-.': 'C',
			'-..': 'D',
			'.': 'E',
			'..-.': 'F',
			'--.': 'G',
			'....': 'H',
			'..': 'I',
			'.---': 'J',
			'-.-': 'K',
			'.-..': 'L',
			'--': 'M',
			'-.': 'N',
			'---': 'O',
			'.--.': 'P',
			'--.-': 'Q',
			'.-.': 'R',
			'...': 'S',
			'-': 'T',
			'..-': 'U',
			'...-': 'V',
			'.--': 'W',
			'-..-': 'X',
			'-.--': 'Y',
			'--..': 'Z',
			'.----': '1',
			'..---': '2',
			'...--': '3',
			'....-': '4',
			'.....': '5',
			'-....': '6',
			'--...': '7',
			'---..': '8',
			'----.': '9',
			'-----': '0'
		};

		return text
			.trim()
			.split(/\s+/)
			.map((code) => morseToChar[code] || '?')
			.join('');
	}

	function decodeQuotedPrintable(text: string): string {
		// Quoted-Printableのデコード
		return text
			.replace(/=([A-F0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
			.replace(/=\r?\n/g, ''); // ソフトラインブレーク
	}

	function decodeUUencode(text: string): string {
		// 簡易的なUUencodeデコード
		const lines = text.split('\n');
		if (!lines[0]?.startsWith('begin ') || !lines[lines.length - 1]?.trim().startsWith('end')) {
			throw new Error('UUencode形式ではありません');
		}

		let result = '';
		for (let i = 1; i < lines.length - 1; i++) {
			const line = lines[i];
			if (!line) continue;

			const length = (line.charCodeAt(0) - 32) & 0x3f;
			let bytes = '';

			for (let j = 1; j < line.length; j++) {
				const val = (line.charCodeAt(j) - 32) & 0x3f;
				bytes += val.toString(2).padStart(6, '0');
			}

			for (let j = 0; j < length; j++) {
				const byte = parseInt(bytes.substring(j * 8, j * 8 + 8), 2);
				result += String.fromCharCode(byte);
			}
		}

		return result;
	}

	// 自動検出機能
	function autoDetect(text: string): DecodeResult[] {
		const results: DecodeResult[] = [];

		// URLエンコード検出
		if (/%[0-9A-Fa-f]{2}/.test(text)) {
			try {
				const decoded = decodeURL(text);
				if (decoded !== text) {
					results.push({
						format: 'URLエンコード',
						result: decoded,
						confidence: 95
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// HTMLエンティティ検出
		if (/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/.test(text)) {
			try {
				const decoded = decodeHTMLEntity(text);
				if (decoded !== text) {
					results.push({
						format: 'HTMLエンティティ',
						result: decoded,
						confidence: 95
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// Base64検出
		if (/^[A-Za-z0-9+/]+=*$/.test(text.trim()) && text.length % 4 === 0) {
			try {
				const decoded = decodeBase64(text);
				results.push({
					format: 'Base64',
					result: decoded,
					confidence: 90
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// Unicode エスケープ検出 (\uHHHH)
		if (/\\u[0-9a-fA-F]{4}/.test(text)) {
			try {
				const decoded = decodeUnicodeJS(text);
				if (decoded !== text) {
					results.push({
						format: 'Unicode (\\uHHHH)',
						result: decoded,
						confidence: 95
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// Unicode コードポイント検出 (\u{...})
		if (/\\u\{[0-9a-fA-F]+\}/.test(text)) {
			try {
				const decoded = decodeUnicodeCodePoint(text);
				if (decoded !== text) {
					results.push({
						format: 'Unicode (\\u{...})',
						result: decoded,
						confidence: 95
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// CSS Unicode検出
		if (/\\[0-9a-fA-F]{1,6}(?:\s|$)/.test(text)) {
			try {
				const decoded = decodeUnicodeCSS(text);
				if (decoded !== text) {
					results.push({
						format: 'CSS Unicode',
						result: decoded,
						confidence: 85
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 16進数エスケープ検出 (\xHH)
		if (/\\x[0-9a-fA-F]{2}/.test(text)) {
			try {
				const decoded = decodeHexJS(text);
				if (decoded !== text) {
					results.push({
						format: '16進数 (\\xHH)',
						result: decoded,
						confidence: 90
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 8進数エスケープ検出 (\NNN)
		if (/\\[0-7]{1,3}/.test(text)) {
			try {
				const decoded = decodeOctalJS(text);
				if (decoded !== text) {
					results.push({
						format: '8進数 (\\NNN)',
						result: decoded,
						confidence: 80
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// JSON文字列検出
		if (/^".*"$/.test(text.trim())) {
			try {
				const decoded = decodeJSONString(text.trim());
				results.push({
					format: 'JSON文字列',
					result: decoded,
					confidence: 90
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// Punycode検出
		if (/^xn--[a-z0-9]+$/i.test(text.trim())) {
			try {
				const decoded = decodePunycode(text.trim());
				if (decoded !== text.trim()) {
					results.push({
						format: 'Punycode',
						result: decoded,
						confidence: 95
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// ROT13検出（アルファベットのみの場合）
		if (/^[a-zA-Z\s]+$/.test(text)) {
			try {
				const decoded = decodeROT13(text);
				results.push({
					format: 'ROT13',
					result: decoded,
					confidence: 50
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 2進数検出
		if (/^[01\s]+$/.test(text.trim()) && /[01]{8}/.test(text)) {
			try {
				const decoded = decodeBinary(text.replace(/\s/g, ''));
				results.push({
					format: '2進数',
					result: decoded,
					confidence: 85
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 10進数検出（スペース区切り）
		if (/^\d+(\s+\d+)+$/.test(text.trim())) {
			try {
				const decoded = decodeDecimal(text);
				const nums = text
					.trim()
					.split(/\s+/)
					.map((n) => parseInt(n, 10));
				// ASCII範囲内かチェック
				if (nums.every((n) => n >= 32 && n <= 126)) {
					results.push({
						format: '10進数',
						result: decoded,
						confidence: 75
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 16進数検出（スペース区切り）
		if (/^[0-9a-fA-F]+(\s+[0-9a-fA-F]+)+$/.test(text.trim())) {
			try {
				const decoded = decodeHexNum(text);
				results.push({
					format: '16進数',
					result: decoded,
					confidence: 80
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// モールス信号検出
		if (/^[.\-\s]+$/.test(text)) {
			try {
				const decoded = decodeMorse(text);
				results.push({
					format: 'Morse Code',
					result: decoded,
					confidence: 70
				});
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// Quoted-Printable検出
		if (/=[A-F0-9]{2}/.test(text)) {
			try {
				const decoded = decodeQuotedPrintable(text);
				if (decoded !== text) {
					results.push({
						format: 'Quoted-Printable',
						result: decoded,
						confidence: 85
					});
				}
			} catch {
				// デコード失敗時はスキップ
			}
		}

		// 信頼度順にソート
		return results.sort((a, b) => b.confidence - a.confidence);
	}

	// デコード実行
	function performDecode() {
		errorMessage = '';
		decodeResults = [];

		if (!inputText.trim()) {
			errorMessage = '入力テキストを入力してください';
			return;
		}

		// 入力サイズ制限（10MB）
		const MAX_INPUT_SIZE = 10 * 1024 * 1024;
		if (inputText.length > MAX_INPUT_SIZE) {
			errorMessage = `入力が大きすぎます（最大: ${(MAX_INPUT_SIZE / 1024 / 1024).toFixed(0)}MB）`;
			return;
		}

		try {
			if (selectedFormat === 'auto') {
				// 自動検出
				const results = autoDetect(inputText);
				if (results.length === 0) {
					errorMessage = 'エンコード形式を検出できませんでした';
				} else {
					decodeResults = results;
				}
			} else {
				// 手動選択
				let result = '';
				let formatName = formatInfo[selectedFormat].label;

				switch (selectedFormat) {
					case 'url':
						result = decodeURL(inputText);
						break;
					case 'html-entity':
						result = decodeHTMLEntity(inputText);
						break;
					case 'base64':
						result = decodeBase64(inputText);
						break;
					case 'unicode-js':
						result = decodeUnicodeJS(inputText);
						break;
					case 'unicode-css':
						result = decodeUnicodeCSS(inputText);
						break;
					case 'unicode-codepoint':
						result = decodeUnicodeCodePoint(inputText);
						break;
					case 'hex-js':
						result = decodeHexJS(inputText);
						break;
					case 'octal-js':
						result = decodeOctalJS(inputText);
						break;
					case 'json-string':
						result = decodeJSONString(inputText);
						break;
					case 'punycode':
						result = decodePunycode(inputText);
						break;
					case 'base58':
						result = decodeBase58(inputText);
						break;
					case 'rot13':
						result = decodeROT13(inputText);
						break;
					case 'binary':
						result = decodeBinary(inputText.replace(/\s/g, ''));
						break;
					case 'octal-num':
						result = decodeOctalNum(inputText);
						break;
					case 'decimal':
						result = decodeDecimal(inputText);
						break;
					case 'hex-num':
						result = decodeHexNum(inputText);
						break;
					case 'morse':
						result = decodeMorse(inputText);
						break;
					case 'quoted-printable':
						result = decodeQuotedPrintable(inputText);
						break;
					case 'uuencode':
						result = decodeUUencode(inputText);
						break;
				}

				decodeResults = [{ format: formatName, result, confidence: 100 }];
			}

			// 自動コピー（最も信頼度の高い結果）
			if (decodeResults.length > 0) {
				copyToClipboard(decodeResults[0].result);
			}
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = 'デコードに失敗しました';
			}
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
		decodeResults = [];
		errorMessage = '';
	}

	// サンプル読み込み
	const samples: Record<string, { input: string; description: string }> = {
		url: {
			input: '%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF%E4%B8%96%E7%95%8C',
			description: 'URLエンコード'
		},
		html: {
			input: '&lt;div&gt;&#12371;&#12435;&#12395;&#12385;&#12399;&lt;/div&gt;',
			description: 'HTMLエンティティ'
		},
		base64: {
			input: 'SGVsbG8gV29ybGQh',
			description: 'Base64'
		},
		unicode: {
			input: '\\u3053\\u3093\\u306b\\u3061\\u306f',
			description: 'Unicode エスケープ'
		}
	};

	let sampleKey = $state('url');

	function loadSample() {
		inputText = samples[sampleKey].input;
		selectedFormat = 'auto';
		performDecode();
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 形式選択 -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center">
			<Icon icon="mdi:cog" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">デコード設定</h3>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div>
				<label for="format" class="mb-2 block text-sm font-medium text-gray-700"
					>エンコード形式</label
				>
				<select
					id="format"
					bind:value={selectedFormat}
					class="w-full rounded border border-gray-300 p-2"
				>
					{#each Object.entries(formatInfo) as [key, info] (key)}
						<option value={key}>{info.label}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="sample" class="mb-2 block text-sm font-medium text-gray-700">サンプル選択</label
				>
				<div class="flex gap-2">
					<select
						id="sample"
						bind:value={sampleKey}
						class="flex-1 rounded border border-gray-300 p-2"
					>
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
		</div>

		{#if selectedFormat !== 'auto'}
			<div class="mt-3 rounded bg-blue-50 p-3 text-sm">
				<div class="font-medium text-blue-900">{formatInfo[selectedFormat].label}</div>
				<div class="text-blue-700">{formatInfo[selectedFormat].description}</div>
				{#if formatInfo[selectedFormat].example}
					<div class="mt-1 font-mono text-xs text-blue-600">
						例: {formatInfo[selectedFormat].example}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- アクションボタン -->
	<div class="mb-4 flex items-center justify-center gap-3">
		<button
			onclick={performDecode}
			disabled={!inputText}
			class="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
		>
			<Icon icon="mdi:play" class="mr-2 inline h-4 w-4" />
			デコード実行
		</button>
		<button onclick={clear} class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600">
			<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
			クリア
		</button>
	</div>

	<!-- 入力エリア -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-4">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="font-medium text-gray-900">入力（エンコードされた文字列）</h3>
			<div class="text-xs text-gray-500">
				{inputText.length.toLocaleString()} 文字
			</div>
		</div>
		<textarea
			bind:value={inputText}
			placeholder="エンコードされた文字列を入力してください..."
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

	<!-- デコード結果 -->
	{#if decodeResults.length > 0}
		<div class="space-y-4">
			<h3 class="text-lg font-medium text-gray-900">
				デコード結果 ({decodeResults.length}件)
			</h3>

			{#each decodeResults as result, index (`${result.format}-${index}`)}
				<div
					class="rounded-lg border bg-white p-4 {index === 0
						? 'border-green-300 bg-green-50'
						: 'border-gray-200'}"
				>
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Icon
								icon={index === 0 ? 'mdi:check-circle' : 'mdi:information'}
								class="h-5 w-5 {index === 0 ? 'text-green-600' : 'text-gray-600'}"
							/>
							<span class="font-medium text-gray-900">{result.format}</span>
							<span class="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700"
								>信頼度: {result.confidence}%</span
							>
							{#if index === 0}
								<span class="rounded bg-green-200 px-2 py-1 text-xs font-medium text-green-800"
									>推奨</span
								>
							{/if}
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
	{/if}

	<!-- 使い方ガイド -->
	<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:lightbulb-outline" class="mr-2 h-5 w-5 text-gray-600" />
			<h3 class="font-medium text-gray-900">使い方</h3>
		</div>
		<div class="space-y-2 text-sm text-gray-600">
			<p>• <strong>自動検出モード</strong>: 入力から20種類以上のエンコード形式を自動推定</p>
			<p>• <strong>手動選択モード</strong>: 特定のエンコード形式を指定してデコード</p>
			<p>• <strong>複数候補表示</strong>: 自動検出時は信頼度順に複数の候補を表示</p>
			<p>• <strong>自動コピー</strong>: 最も信頼度の高い結果を自動的にクリップボードにコピー</p>
		</div>
	</div>

	<!-- 対応形式一覧 -->
	<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="mb-2 flex items-center">
			<Icon icon="mdi:format-list-bulleted" class="mr-2 h-5 w-5 text-blue-600" />
			<h3 class="font-medium text-blue-900">対応エンコード形式（20種類）</h3>
		</div>
		<div class="grid gap-2 text-sm text-blue-700 md:grid-cols-2 lg:grid-cols-3">
			{#each Object.entries(formatInfo).filter(([key]) => key !== 'auto') as [key, info] (key)}
				<div>• {info.label}</div>
			{/each}
		</div>
	</div>
</div>
