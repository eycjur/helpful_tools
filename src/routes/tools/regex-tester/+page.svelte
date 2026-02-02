<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'regex-tester');

	let pattern = '';
	let flags = { g: true, i: false, m: false, s: false, u: true };
	let inputText = '';
	let error: string | null = null;

	type MatchInfo = {
		index: number;
		length: number;
		text: string;
		captures: string[];
		groups?: Record<string, string>;
	};

	let matches: MatchInfo[] = [];
	let highlightedHtml = '';

	type Example = {
		label: string;
		pattern: string;
		flags?: Partial<typeof flags>;
		sample?: string;
	};

	const examples: Example[] = [
		{
			label: 'メールアドレス',
			pattern: '^[\\w.%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
			flags: { g: false, i: true, m: false, s: false, u: true },
			sample: 'contact@example.com\ninfo@test.co.jp\nNG: name@domain'
		},
		{
			label: 'URL (http/https)',
			pattern: 'https?:\\/\\/[\\w.-]+(?:\\/[\\w./?%&=-]*)?',
			flags: { g: true, u: true },
			sample: 'Visit https://example.com or http://test.local/path?x=1'
		},
		{
			label: 'IPv4 アドレス',
			pattern: '\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b',
			flags: { g: true, u: true },
			sample: 'Local: 192.168.0.1\nPublic: 8.8.8.8\nNG: 999.1.1.1'
		},
		{
			label: '日付 YYYY-MM-DD',
			pattern: '\\b\\d{4}-\\d{2}-\\d{2}\\b',
			flags: { g: true, u: true },
			sample: 'Today: 2025-09-14\nText: 2025/09/14'
		},
		{
			label: '数字（カンマ区切り）',
			pattern: '\\b\\d{1,3}(?:,\\d{3})*\\b',
			flags: { g: true, u: true },
			sample: '1,234\n12,345,678\nNG: 1234,'
		},
		{
			label: 'ひらがな',
			pattern: '\\p{Script=Hiragana}+',
			flags: { g: true, u: true },
			sample: 'ひらがな と カタカナ'
		},
		{
			label: 'カタカナ',
			pattern: '\\p{Script=Katakana}+',
			flags: { g: true, u: true },
			sample: 'ひらがな と カタカナ'
		},
		{
			label: '前後の空白',
			pattern: '^\\s+|\\s+$',
			flags: { g: true },
			sample: '  前後に空白  '
		}
	];

	function applyExample(ex: Example) {
		pattern = ex.pattern;
		flags = {
			g: false,
			i: false,
			m: false,
			s: false,
			u: true,
			...(ex.flags ?? {})
		};
		if (ex.sample) inputText = ex.sample;
		recompute();
	}

	function currentFlags() {
		const f = Object.entries(flags)
			.filter(([, v]) => v)
			.map(([k]) => k)
			.join('');
		return f as string;
	}

	function escapeHtml(s: string) {
		return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	}

	function recompute() {
		error = null;
		matches = [];
		highlightedHtml = '';

		// 入力サイズ制限（100KB）- ReDoS対策
		const MAX_INPUT_SIZE = 100_000; // 100KB
		if (inputText.length > MAX_INPUT_SIZE) {
			error = `入力が大きすぎます（最大: ${(MAX_INPUT_SIZE / 1000).toFixed(0)}KB）`;
			highlightedHtml = `<pre class="whitespace-pre-wrap break-words">${escapeHtml(inputText)}</pre>`;
			return;
		}

		if (!pattern) {
			highlightedHtml = `<pre class="whitespace-pre-wrap break-words">${escapeHtml(inputText)}</pre>`;
			return;
		}

		let re: RegExp;
		try {
			re = new RegExp(pattern, currentFlags());
		} catch (e) {
			error = (e as Error).message;
			highlightedHtml = `<pre class="whitespace-pre-wrap break-words">${escapeHtml(inputText)}</pre>`;
			return;
		}

		// 走査
		const ranges: Array<{ start: number; end: number }> = [];
		if (re.global) {
			let m: RegExpExecArray | null;
			while ((m = re.exec(inputText)) !== null) {
				const text = m[0];
				const idx = m.index;
				matches.push({
					index: idx,
					length: text.length,
					text,
					captures: m.slice(1),
					groups: m.groups ?? undefined
				});
				if (text.length > 0) ranges.push({ start: idx, end: idx + text.length });
				// 無限ループ対策（ゼロ幅一致）
				if (text.length === 0) re.lastIndex++;
			}
		} else {
			const m = re.exec(inputText);
			if (m) {
				const text = m[0];
				const idx = m.index;
				matches.push({
					index: idx,
					length: text.length,
					text,
					captures: m.slice(1),
					groups: m.groups ?? undefined
				});
				if (text.length > 0) ranges.push({ start: idx, end: idx + text.length });
			}
		}

		// ハイライトHTML生成
		if (!ranges.length) {
			highlightedHtml = `<pre class="whitespace-pre-wrap break-words">${escapeHtml(inputText)}</pre>`;
			return;
		}
		let html = '';
		let cursor = 0;
		for (const r of ranges) {
			if (cursor < r.start) html += escapeHtml(inputText.slice(cursor, r.start));
			const frag = escapeHtml(inputText.slice(r.start, r.end));
			html += `<mark class="bg-yellow-200 text-black">${frag}</mark>`;
			cursor = r.end;
		}
		if (cursor < inputText.length) html += escapeHtml(inputText.slice(cursor));
		highlightedHtml = `<pre class="whitespace-pre-wrap break-words">${html}</pre>`;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- 左: 入力/設定 -->
		<div class="flex flex-col gap-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 flex items-center justify-between">
					<label for="regex-pattern-input" class="text-sm font-medium text-gray-700"
						>【入力】正規表現</label
					>
					<button
						on:click={() => {
							pattern = '';
							error = null;
							recompute();
						}}
						class="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
						>クリア</button
					>
				</div>
				<div class="mt-1 flex items-center gap-2">
					<input
						id="regex-pattern-input"
						type="text"
						bind:value={pattern}
						on:input={recompute}
						placeholder="例: (foo|bar)+"
						class="w-full rounded border-gray-300 px-3 py-2"
					/>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
					<label class="inline-flex items-center gap-2">
						<input type="checkbox" bind:checked={flags.g} on:change={recompute} />
						<span class="text-gray-800">g</span>
						<span class="text-gray-600">全ての一致を取得</span>
					</label>
					<label class="inline-flex items-center gap-2">
						<input type="checkbox" bind:checked={flags.i} on:change={recompute} />
						<span class="text-gray-800">i</span>
						<span class="text-gray-600">大文字小文字を区別しない</span>
					</label>
					<label class="inline-flex items-center gap-2">
						<input type="checkbox" bind:checked={flags.m} on:change={recompute} />
						<span class="text-gray-800">m</span>
						<span class="text-gray-600">^/$を行ごとに扱う</span>
					</label>
					<label class="inline-flex items-center gap-2">
						<input type="checkbox" bind:checked={flags.s} on:change={recompute} />
						<span class="text-gray-800">s</span>
						<span class="text-gray-600">. を改行にも一致させる</span>
					</label>
					<label class="inline-flex items-center gap-2">
						<input type="checkbox" bind:checked={flags.u} on:change={recompute} />
						<span class="text-gray-800">u</span>
						<span class="text-gray-600">絵文字なども1文字として扱う</span>
					</label>
				</div>
				{#if error}
					<div class="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
				{/if}
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 flex items-center justify-between">
					<label for="test-text-textarea" class="text-sm font-medium text-gray-700"
						>【入力】テスト文字列</label
					>
					<button
						on:click={() => {
							inputText = '';
							recompute();
						}}
						class="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
						>クリア</button
					>
				</div>
				<textarea
					id="test-text-textarea"
					bind:value={inputText}
					on:input={recompute}
					class="mt-1 h-32 w-full resize-y rounded border-gray-300 p-3 font-mono text-sm"
					placeholder="ここにテキストを入力してパターンを試します"
				></textarea>
			</div>

			<div class="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
				<div class="mb-2 text-sm font-semibold text-indigo-800">凡例: 先読み / 後読み</div>
				<ul class="space-y-2 text-sm text-gray-800">
					<li class="rounded bg-white/40 p-2">
						<span class="font-medium text-gray-800">肯定先読み:</span>
						<code class="mx-1 rounded bg-white px-1 py-0.5 text-gray-800">X(?=Y)</code>
						<span class="text-gray-600">直後がYのX</span>
					</li>
					<li class="rounded bg-white/40 p-2">
						<span class="font-medium text-gray-800">否定先読み:</span>
						<code class="mx-1 rounded bg-white px-1 py-0.5 text-gray-800">X(?!Y)</code>
						<span class="text-gray-600">直後がY以外のX</span>
					</li>
					<li class="rounded bg-white/40 p-2">
						<span class="font-medium text-gray-800">肯定後読み:</span>
						<code class="mx-1 rounded bg-white px-1 py-0.5 text-gray-800">(?&lt;=X)Y</code>
						<span class="text-gray-600">直前がXのY</span>
					</li>
					<li class="rounded bg-white/40 p-2">
						<span class="font-medium text-gray-800">否定後読み:</span>
						<code class="mx-1 rounded bg-white px-1 py-0.5 text-gray-800">(?&lt;!X)Y</code>
						<span class="text-gray-600">直前がX以外のY</span>
					</li>
				</ul>

				<div class="mt-4 border-t border-indigo-100 pt-3">
					<div class="mb-2 text-sm font-semibold text-indigo-800">よく使う正規表現</div>
					<ul class="space-y-2">
						{#each examples as ex (ex.pattern)}
							<li
								class="flex items-start justify-between rounded border border-indigo-100 bg-white/60 p-2"
							>
								<div class="pr-3">
									<div class="text-sm font-medium text-gray-800">{ex.label}</div>
									<div class="mt-1 overflow-x-auto text-xs text-gray-700">
										<code>{ex.pattern}</code>
									</div>
								</div>
								<div class="shrink-0 self-center">
									<button
										on:click={() => applyExample(ex)}
										class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
										>セット</button
									>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>

		<!-- 右: 結果表示 -->
		<div class="flex flex-col gap-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-2 text-sm font-medium text-gray-700">
					【出力】一致ハイライト <span class="ml-2 text-xs text-gray-500"
						>一致: {matches.length} 件</span
					>
				</div>
				<div class="rounded border border-gray-100 bg-gray-50 p-3">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html highlightedHtml}
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 text-sm font-medium text-gray-700">マッチ詳細</div>
				{#if matches.length}
					<ul class="space-y-3">
						{#each matches as m, i (i)}
							<li class="rounded border border-gray-100 bg-gray-50 p-3">
								<div class="mb-1 text-sm text-gray-700">#{i + 1} @ {m.index} ({m.length}文字)</div>
								<div class="mb-2 overflow-x-auto rounded bg-white p-2 font-mono text-sm">
									<code>{m.text}</code>
								</div>
								{#if m.captures.length}
									<div class="mb-1 text-xs text-gray-600">キャプチャ:</div>
									<ul class="mb-2 grid grid-cols-1 gap-1 md:grid-cols-2">
										{#each m.captures as c, idx (idx)}
											<li class="rounded bg-white p-2 font-mono text-xs">
												<span class="text-gray-500">[{idx + 1}]</span>
												{c}
											</li>
										{/each}
									</ul>
								{/if}
								{#if m.groups}
									<div class="mb-1 text-xs text-gray-600">名前付きグループ:</div>
									<ul class="grid grid-cols-1 gap-1 md:grid-cols-2">
										{#each Object.entries(m.groups) as entry (entry[0])}
											<li class="rounded bg-white p-2 font-mono text-xs">
												<span class="text-gray-500">{entry[0]}:</span>
												{entry[1]}
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<div class="text-sm text-gray-500">一致はありません</div>
				{/if}
			</div>
		</div>
	</div>
</div>
