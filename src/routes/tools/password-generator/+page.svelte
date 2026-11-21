<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'password-generator');

	// 設定
	let length: number | undefined = 16;
	const minLength = 4;
	const maxLength = 20;
	const count = 5; // 固定
	let includeUppercase = true;
	let includeLowercase = true;
	let includeNumbers = true;
	let includeSymbols = true;
	let excludeAmbiguous = true;

	// 文字セット
	const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
	const numberChars = '0123456789';
	const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
	const ambiguousChars = 'O0Il1';

	// 生成されたパスワード
	let passwords: string[] = [];
	let strength = describeStrength(0);
	let copiedIndex: number | null = null;

	// 紛らわしい文字を除外するヘルパー
	function filterAmbiguous(chars: string): string {
		if (!excludeAmbiguous) return chars;
		return chars
			.split('')
			.filter((c) => !ambiguousChars.includes(c))
			.join('');
	}

	function getRandomIndex(size: number): number {
		const array = new Uint32Array(1);
		const limit = Math.floor(2 ** 32 / size) * size;
		do {
			crypto.getRandomValues(array);
		} while (array[0] >= limit);
		return array[0] % size;
	}

	function getCharacterSets(): string[] {
		const charsets: string[] = [];
		if (includeUppercase) charsets.push(filterAmbiguous(uppercaseChars));
		if (includeLowercase) charsets.push(filterAmbiguous(lowercaseChars));
		if (includeNumbers) charsets.push(filterAmbiguous(numberChars));
		if (includeSymbols) charsets.push(filterAmbiguous(symbolChars));
		return charsets;
	}

	function generatePassword(passwordLength: number, charsets: string[]): string {
		const allChars = charsets.join('');
		const characters = charsets.map((charset) => charset[getRandomIndex(charset.length)]);
		while (characters.length < passwordLength) {
			characters.push(allChars[getRandomIndex(allChars.length)]);
		}

		// Fisher-Yatesシャッフル
		for (let i = characters.length - 1; i > 0; i--) {
			const j = getRandomIndex(i + 1);
			[characters[i], characters[j]] = [characters[j], characters[i]];
		}

		return characters.join('');
	}

	// 複数のパスワードを生成
	function isValidLength(value: number | undefined): value is number {
		return (
			value !== undefined && Number.isInteger(value) && value >= minLength && value <= maxLength
		);
	}

	function generatePasswords(passwordLength: number | undefined) {
		passwords = [];
		copiedIndex = null;
		if (noCharsetSelected || !isValidLength(passwordLength)) return;

		const charsets = getCharacterSets();
		passwords = Array.from({ length: count }, () => generatePassword(passwordLength, charsets));
		strength = describeStrength(calculateMinimumEntropy(passwordLength, charsets));
	}

	function calculateMinimumEntropy(passwordLength: number, charsets: string[]): number {
		const poolSize = charsets.reduce((total, charset) => total + charset.length, 0);
		const balancedCount = Math.floor(passwordLength / charsets.length);
		const extraCount = passwordLength % charsets.length;
		let entropy = (passwordLength - charsets.length) * Math.log2(poolSize);
		// 各文字種の出現数の積が最大になる均等な配分が、最も生成されやすい。
		for (const [i, charset] of charsets.entries()) {
			const occurrences = balancedCount + (i < extraCount ? 1 : 0);
			entropy += Math.log2(((passwordLength - i) * charset.length) / occurrences);
		}
		return entropy;
	}

	function describeStrength(entropy: number): {
		score: number;
		label: string;
		color: string;
		entropy: number;
	} {
		if (entropy < 28) return { score: 1, label: '非常に弱い', color: 'red', entropy };
		if (entropy < 36) return { score: 2, label: '弱い', color: 'orange', entropy };
		if (entropy < 60) return { score: 3, label: '普通', color: 'yellow', entropy };
		if (entropy < 80) return { score: 4, label: '強い', color: 'lime', entropy };
		return { score: 5, label: '非常に強い', color: 'green', entropy };
	}

	// クリップボードにコピー
	async function copyToClipboard(text: string, index: number) {
		try {
			await navigator.clipboard.writeText(text);
			copiedIndex = index;
			setTimeout(() => {
				copiedIndex = null;
			}, 2000);
		} catch (err) {
			console.error('コピーに失敗しました:', err);
		}
	}

	// すべてコピー
	async function copyAll() {
		try {
			await navigator.clipboard.writeText(passwords.join('\n'));
			copiedIndex = -1;
			setTimeout(() => {
				copiedIndex = null;
			}, 2000);
		} catch (err) {
			console.error('コピーに失敗しました:', err);
		}
	}

	// 文字種が1つも選択されていない場合の警告
	$: noCharsetSelected =
		!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols;
	$: invalidLength = !isValidLength(length);

	// 設定変更時に自動生成
	$: {
		// 依存する変数を明示的に参照
		void [
			noCharsetSelected,
			includeUppercase,
			includeLowercase,
			includeNumbers,
			includeSymbols,
			excludeAmbiguous
		];
		generatePasswords(length);
	}
</script>

<div class="mx-auto max-w-3xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 設定パネル -->
	<div class="mb-4 rounded-lg border border-gray-200 bg-white p-4">
		<!-- パスワードの長さ -->
		<div class="mb-3">
			<label for="length" class="mb-1 block text-xs font-medium text-gray-700">
				長さ: <span class="font-mono font-bold text-blue-600">{length}</span>文字
			</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					id="length"
					bind:value={length}
					min={minLength}
					max={maxLength}
					class="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200"
				/>
				<input
					type="number"
					bind:value={length}
					min={minLength}
					max={maxLength}
					aria-label="パスワードの長さ"
					aria-invalid={invalidLength}
					class="w-14 rounded border border-gray-300 px-1 py-0.5 text-center font-mono text-sm"
				/>
			</div>
		</div>

		<!-- 文字種の選択 -->
		<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
			<span class="text-xs font-medium text-gray-700">文字種:</span>
			<label class="flex cursor-pointer items-center gap-1">
				<input type="checkbox" bind:checked={includeUppercase} class="h-3.5 w-3.5 text-blue-600" />
				<span class="text-xs">大文字</span>
			</label>
			<label class="flex cursor-pointer items-center gap-1">
				<input type="checkbox" bind:checked={includeLowercase} class="h-3.5 w-3.5 text-blue-600" />
				<span class="text-xs">小文字</span>
			</label>
			<label class="flex cursor-pointer items-center gap-1">
				<input type="checkbox" bind:checked={includeNumbers} class="h-3.5 w-3.5 text-blue-600" />
				<span class="text-xs">数字</span>
			</label>
			<label class="flex cursor-pointer items-center gap-1">
				<input type="checkbox" bind:checked={includeSymbols} class="h-3.5 w-3.5 text-blue-600" />
				<span class="text-xs">記号</span>
			</label>
			<span class="text-gray-300">|</span>
			<label class="flex cursor-pointer items-center gap-1">
				<input type="checkbox" bind:checked={excludeAmbiguous} class="h-3.5 w-3.5 text-blue-600" />
				<span class="text-xs text-gray-600">紛らわしい文字を除外</span>
			</label>
		</div>

		<!-- エラー表示 -->
		{#if noCharsetSelected}
			<div class="mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
				<Icon icon="mdi:alert-circle" class="mr-1 inline h-3.5 w-3.5" />
				少なくとも1つの文字種を選択してください
			</div>
		{/if}
		{#if invalidLength}
			<div class="mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
				<Icon icon="mdi:alert-circle" class="mr-1 inline h-3.5 w-3.5" />
				長さは{minLength}〜{maxLength}の整数を入力してください
			</div>
		{/if}

		<!-- 再生成ボタン -->
		<button
			on:click={() => generatePasswords(length)}
			disabled={noCharsetSelected || invalidLength}
			class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Icon icon="mdi:refresh" class="mr-1 inline h-4 w-4" />
			再生成
		</button>
	</div>

	<!-- 生成結果 -->
	{#if passwords.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-gray-900">生成されたパスワード</h2>
				<button
					on:click={copyAll}
					class="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
				>
					{#if copiedIndex === -1}
						<Icon icon="mdi:check" class="mr-1 inline h-4 w-4" />
						コピー完了
					{:else}
						<Icon icon="mdi:content-copy" class="mr-1 inline h-4 w-4" />
						すべてコピー
					{/if}
				</button>
			</div>

			<div class="space-y-3">
				{#each passwords as password, index (index)}
					<div class="rounded-lg border border-gray-100 bg-gray-50 p-4">
						<div class="flex items-center gap-3">
							<!-- パスワード -->
							<div
								class="flex-1 overflow-x-auto rounded bg-white px-4 py-2 font-mono text-lg whitespace-nowrap"
							>
								{password}
							</div>

							<!-- コピーボタン -->
							<button
								on:click={() => copyToClipboard(password, index)}
								class="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
								title="コピー"
							>
								{#if copiedIndex === index}
									<Icon icon="mdi:check" class="h-5 w-5" />
								{:else}
									<Icon icon="mdi:content-copy" class="h-5 w-5" />
								{/if}
							</button>
						</div>

						<!-- 強度インジケーター -->
						<div class="mt-2 flex items-center gap-2">
							<div class="flex gap-1">
								{#each [1, 2, 3, 4, 5] as level (level)}
									<div
										class="h-2 w-6 rounded-sm {level <= strength.score
											? strength.color === 'red'
												? 'bg-red-500'
												: strength.color === 'orange'
													? 'bg-orange-500'
													: strength.color === 'yellow'
														? 'bg-yellow-500'
														: strength.color === 'lime'
															? 'bg-lime-500'
															: 'bg-green-500'
											: 'bg-gray-200'}"
									></div>
								{/each}
							</div>
							<span
								class="text-xs font-medium {strength.color === 'red'
									? 'text-red-600'
									: strength.color === 'orange'
										? 'text-orange-600'
										: strength.color === 'yellow'
											? 'text-yellow-600'
											: strength.color === 'lime'
												? 'text-lime-600'
												: 'text-green-600'}"
							>
								{strength.label}
							</span>
							<span class="text-xs text-gray-500">
								(最小エントロピー: {strength.entropy.toFixed(1)} bits)
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
