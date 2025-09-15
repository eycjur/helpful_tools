<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'curl-builder');

	// 基本設定
	let url = '';
	let method = 'GET';

	// ヘッダー
	interface Header {
		key: string;
		value: string;
		enabled: boolean;
	}

	let headers: Header[] = [
		{ key: 'Content-Type', value: 'application/json', enabled: true },
		{ key: 'User-Agent', value: 'curl/7.68.0', enabled: false }
	];

	// リクエストボディ
	let bodyType: 'none' | 'json' | 'form' | 'raw' = 'none';
	let jsonBody = '{\n  "key": "value"\n}';
	let rawBody = '';

	interface FormData {
		key: string;
		value: string;
		enabled: boolean;
	}

	let formData: FormData[] = [{ key: '', value: '', enabled: true }];

	// 認証
	let authType: 'none' | 'basic' | 'bearer' = 'none';
	let username = '';
	let password = '';
	let bearerToken = '';

	// 追加オプション
	let followRedirects = false;
	let includeHeaders = false;
	let headRequest = false;
	let verbose = false;
	let timeout = 0;
	let insecure = false;

	// 生成されたコマンド
	let generatedCommand = '';

	// HTTPメソッド選択肢
	const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

	// ヘッダーの追加
	function addHeader() {
		headers = [...headers, { key: '', value: '', enabled: true }];
	}

	// ヘッダーの削除
	function removeHeader(index: number) {
		headers = headers.filter((_, i) => i !== index);
	}

	// フォームデータの追加
	function addFormData() {
		formData = [...formData, { key: '', value: '', enabled: true }];
	}

	// フォームデータの削除
	function removeFormData(index: number) {
		formData = formData.filter((_, i) => i !== index);
	}

	// コマンド生成
	function generateCurlCommand(): string {
		console.log('generateCurlCommand called with url:', JSON.stringify(url));

		if (!url.trim()) {
			console.log('URL is empty, returning placeholder message');
			return 'curl # URLを入力してください';
		}

		let command = 'curl';
		const parts: string[] = [];

		// HTTP メソッド
		if (method !== 'GET') {
			parts.push(`-X ${method}`);
		}

		// ヘッダー
		const enabledHeaders = headers.filter((h) => h.enabled && h.key.trim() && h.value.trim());
		enabledHeaders.forEach((header) => {
			parts.push(`-H "${escapeQuotes(header.key)}: ${escapeQuotes(header.value)}"`);
		});

		// 認証
		if (authType === 'basic' && username.trim() && password.trim()) {
			parts.push(`-u "${escapeQuotes(username)}:${escapeQuotes(password)}"`);
		} else if (authType === 'bearer' && bearerToken.trim()) {
			parts.push(`-H "Authorization: Bearer ${escapeQuotes(bearerToken)}"`);
		}

		// リクエストボディ
		if (bodyType === 'json' && jsonBody.trim()) {
			parts.push(`-d '${jsonBody.trim()}'`);
		} else if (bodyType === 'raw' && rawBody.trim()) {
			parts.push(`-d '${rawBody.trim()}'`);
		} else if (bodyType === 'form') {
			const enabledFormData = formData.filter((f) => f.enabled && f.key.trim());
			enabledFormData.forEach((form) => {
				parts.push(`-d "${escapeQuotes(form.key)}=${escapeQuotes(form.value)}"`);
			});
		}

		// 追加オプション
		if (followRedirects) parts.push('-L');
		if (includeHeaders) parts.push('-i');
		if (headRequest) parts.push('-I');
		if (verbose) parts.push('-v');
		if (insecure) parts.push('-k');
		if (timeout > 0) parts.push(`--max-time ${timeout}`);

		// URL（最後に追加）
		parts.push(`"${escapeQuotes(url.trim())}"`);

		// コマンド組み立て（長い場合は複数行に）
		if (parts.join(' ').length > 80) {
			return `${command} \\\n  ${parts.join(' \\\n  ')}`;
		} else {
			return `${command} ${parts.join(' ')}`;
		}
	}

	// 引用符をエスケープ
	function escapeQuotes(str: string): string {
		return str.replace(/"/g, '\\"');
	}

	// リアルタイム更新（依存する変数の変更を検知）
	$: {
		// 各変数への依存を明示的に示す
		void [
			url,
			method,
			headers,
			authType,
			username,
			password,
			bearerToken,
			bodyType,
			jsonBody,
			rawBody,
			formData,
			followRedirects,
			includeHeaders,
			headRequest,
			verbose,
			insecure,
			timeout
		];
		generatedCommand = generateCurlCommand();
	}

	// クリップボードコピー
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// クリア機能
	function clearAll() {
		url = '';
		method = 'GET';
		headers = [
			{ key: 'Content-Type', value: 'application/json', enabled: true },
			{ key: 'User-Agent', value: 'curl/7.68.0', enabled: false }
		];
		bodyType = 'none';
		jsonBody = '{\n  "key": "value"\n}';
		rawBody = '';
		formData = [{ key: '', value: '', enabled: true }];
		authType = 'none';
		username = '';
		password = '';
		bearerToken = '';
		followRedirects = false;
		includeHeaders = false;
		headRequest = false;
		verbose = false;
		timeout = 0;
		insecure = false;
	}

	// プリセット読み込み
	const presets = {
		get: {
			name: 'GET リクエスト',
			setup: () => {
				url = 'https://jsonplaceholder.typicode.com/posts/1';
				method = 'GET';
				bodyType = 'none';
				headers = [{ key: 'Accept', value: 'application/json', enabled: true }];
			}
		},
		postJson: {
			name: 'POST JSON',
			setup: () => {
				url = 'https://jsonplaceholder.typicode.com/posts';
				method = 'POST';
				bodyType = 'json';
				jsonBody = '{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1\n}';
				headers = [{ key: 'Content-Type', value: 'application/json', enabled: true }];
			}
		},
		authBearer: {
			name: 'Bearer Token認証',
			setup: () => {
				url = 'https://api.github.com/user';
				method = 'GET';
				authType = 'bearer';
				bearerToken = 'your-token-here';
				headers = [{ key: 'Accept', value: 'application/vnd.github.v3+json', enabled: true }];
			}
		},
		formData: {
			name: 'フォームデータ',
			setup: () => {
				url = 'https://httpbin.org/post';
				method = 'POST';
				bodyType = 'form';
				formData = [
					{ key: 'name', value: 'John Doe', enabled: true },
					{ key: 'email', value: 'john@example.com', enabled: true }
				];
			}
		},
		headRequest: {
			name: 'HEADリクエスト（ヘッダー情報取得）',
			setup: () => {
				url = 'https://httpbin.org/json';
				method = 'GET';
				bodyType = 'none';
				headRequest = true;
				includeHeaders = true;
				headers = [{ key: 'User-Agent', value: 'curl/7.68.0', enabled: true }];
			}
		}
	};

	function loadPreset(preset: keyof typeof presets) {
		clearAll();
		presets[preset].setup();
	}

	// 共通ヘッダープリセット
	const commonHeaders = [
		{ key: 'Content-Type', value: 'application/json' },
		{ key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
		{ key: 'Accept', value: 'application/json' },
		{ key: 'Accept', value: '*/*' },
		{ key: 'User-Agent', value: 'curl/7.68.0' },
		{ key: 'Cache-Control', value: 'no-cache' },
		{ key: 'X-Requested-With', value: 'XMLHttpRequest' }
	];

	function addCommonHeader(headerTemplate: { key: string; value: string }) {
		headers = [...headers, { ...headerTemplate, enabled: true }];
	}

	// JSON整形
	function formatJSON() {
		try {
			const parsed = JSON.parse(jsonBody);
			jsonBody = JSON.stringify(parsed, null, 2);
		} catch {
			// JSON形式でない場合はそのまま
		}
	}
</script>

<div class="mx-auto max-w-7xl">
	<div class="mb-6 flex items-center justify-between">
		<div class="flex items-center">
			{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
			<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
		</div>
		<div class="flex gap-3">
			<button
				on:click={clearAll}
				class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
			>
				<Icon icon="mdi:trash-can" class="mr-2 inline h-4 w-4" />
				クリア
			</button>
			<button
				on:click={() => copyToClipboard(generatedCommand)}
				disabled={!url.trim()}
				class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
			>
				<Icon icon="mdi:content-copy" class="mr-2 inline h-4 w-4" />
				コマンドコピー
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- 設定パネル -->
		<div class="space-y-6 lg:col-span-2">
			<!-- プリセット -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">プリセット</h3>
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(presets) as [key, preset] (key)}
						<button
							on:click={() => loadPreset(key as keyof typeof presets)}
							class="rounded bg-purple-100 px-3 py-1 text-sm text-purple-700 hover:bg-purple-200"
						>
							{preset.name}
						</button>
					{/each}
				</div>
			</div>

			<!-- 基本設定 -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">基本設定</h3>
				<div class="space-y-3">
					<div class="flex gap-3">
						<select bind:value={method} class="rounded border-gray-300 px-3 py-2">
							{#each httpMethods as m (m)}
								<option value={m}>{m}</option>
							{/each}
						</select>
						<input
							type="url"
							bind:value={url}
							placeholder="https://api.example.com/endpoint"
							class="flex-1 rounded border-gray-300 px-3 py-2"
						/>
					</div>
				</div>
			</div>

			<!-- ヘッダー -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-medium text-gray-900">ヘッダー</h3>
					<div class="flex gap-2">
						<div class="relative">
							<select
								on:change={(e) => {
									const target = e.target as HTMLSelectElement;
									const selected = commonHeaders[parseInt(target.value)];
									if (selected) addCommonHeader(selected);
									target.value = '';
								}}
								class="rounded border-gray-300 px-3 py-1 text-sm"
							>
								<option value="">よく使うヘッダー</option>
								{#each commonHeaders as header, i (i)}
									<option value={i}>{header.key}: {header.value}</option>
								{/each}
							</select>
						</div>
						<button
							on:click={addHeader}
							class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
						>
							<Icon icon="mdi:plus" class="inline h-3 w-3" />
						</button>
					</div>
				</div>
				<div class="space-y-2">
					{#each headers as header, i (i)}
						<div class="flex items-center gap-2">
							<input type="checkbox" bind:checked={header.enabled} class="rounded" />
							<input
								type="text"
								bind:value={header.key}
								placeholder="Header-Name"
								class="flex-1 rounded border-gray-300 px-3 py-1 text-sm"
							/>
							<input
								type="text"
								bind:value={header.value}
								placeholder="value"
								class="flex-1 rounded border-gray-300 px-3 py-1 text-sm"
							/>
							<button
								on:click={() => removeHeader(i)}
								class="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200"
							>
								<Icon icon="mdi:trash-can" class="h-4 w-4" />
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- リクエストボディ -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-medium text-gray-900">リクエストボディ</h3>
					<div class="flex rounded-lg bg-gray-100 p-1">
						{#each ['none', 'json', 'form', 'raw'] as type (type)}
							<button
								on:click={() => (bodyType = type as typeof bodyType)}
								class="rounded px-3 py-1 text-sm transition-colors {bodyType === type
									? 'bg-white text-gray-900 shadow-sm'
									: 'text-gray-600 hover:text-gray-900'}"
							>
								{type === 'none'
									? 'なし'
									: type === 'json'
										? 'JSON'
										: type === 'form'
											? 'フォーム'
											: 'Raw'}
							</button>
						{/each}
					</div>
				</div>

				{#if bodyType === 'json'}
					<div>
						<div class="mb-2 flex justify-between">
							<label class="text-sm text-gray-600">JSON データ</label>
							<button
								on:click={formatJSON}
								class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600 hover:bg-blue-200"
							>
								整形
							</button>
						</div>
						<textarea
							bind:value={jsonBody}
							class="h-32 w-full rounded border-gray-300 p-3 font-mono text-sm"
						></textarea>
					</div>
				{:else if bodyType === 'form'}
					<div class="space-y-2">
						<div class="mb-2 flex justify-between">
							<label class="text-sm text-gray-600">フォームデータ</label>
							<button
								on:click={addFormData}
								class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
							>
								<Icon icon="mdi:plus" class="inline h-3 w-3" />
							</button>
						</div>
						{#each formData as form, i (i)}
							<div class="flex items-center gap-2">
								<input type="checkbox" bind:checked={form.enabled} class="rounded" />
								<input
									type="text"
									bind:value={form.key}
									placeholder="key"
									class="flex-1 rounded border-gray-300 px-3 py-1 text-sm"
								/>
								<input
									type="text"
									bind:value={form.value}
									placeholder="value"
									class="flex-1 rounded border-gray-300 px-3 py-1 text-sm"
								/>
								<button
									on:click={() => removeFormData(i)}
									class="rounded bg-red-100 p-1 text-red-600 hover:bg-red-200"
								>
									<Icon icon="mdi:trash-can" class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				{:else if bodyType === 'raw'}
					<div>
						<label class="mb-2 block text-sm text-gray-600">Raw データ</label>
						<textarea
							bind:value={rawBody}
							placeholder="テキストデータを入力してください"
							class="h-32 w-full rounded border-gray-300 p-3 font-mono text-sm"
						></textarea>
					</div>
				{/if}
			</div>

			<!-- 認証 -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">認証</h3>
				<div class="space-y-3">
					<div class="flex rounded-lg bg-gray-100 p-1">
						{#each ['none', 'basic', 'bearer'] as type (type)}
							<button
								on:click={() => (authType = type as typeof authType)}
								class="flex-1 rounded px-3 py-1 text-sm transition-colors {authType === type
									? 'bg-white text-gray-900 shadow-sm'
									: 'text-gray-600 hover:text-gray-900'}"
							>
								{type === 'none' ? 'なし' : type === 'basic' ? 'Basic' : 'Bearer'}
							</button>
						{/each}
					</div>

					{#if authType === 'basic'}
						<div class="grid grid-cols-2 gap-3">
							<input
								type="text"
								bind:value={username}
								placeholder="ユーザー名"
								class="rounded border-gray-300 px-3 py-2"
							/>
							<input
								type="password"
								bind:value={password}
								placeholder="パスワード"
								class="rounded border-gray-300 px-3 py-2"
							/>
						</div>
					{:else if authType === 'bearer'}
						<input
							type="text"
							bind:value={bearerToken}
							placeholder="Bearer トークン"
							class="w-full rounded border-gray-300 px-3 py-2"
						/>
					{/if}
				</div>
			</div>

			<!-- 追加オプション -->
			<div class="rounded-lg border border-gray-200 bg-white p-4">
				<h3 class="mb-3 font-medium text-gray-900">追加オプション</h3>
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-4">
						<label class="inline-flex items-center">
							<input type="checkbox" bind:checked={followRedirects} class="rounded" />
							<span class="ml-2 text-sm">リダイレクトを追従 (-L)</span>
						</label>
						<label class="inline-flex items-center">
							<input type="checkbox" bind:checked={includeHeaders} class="rounded" />
							<span class="ml-2 text-sm">レスポンスヘッダーを含める (-i)</span>
						</label>
						<label class="inline-flex items-center">
							<input type="checkbox" bind:checked={headRequest} class="rounded" />
							<span class="ml-2 text-sm">HEADリクエスト（ヘッダーのみ） (-I)</span>
						</label>
						<label class="inline-flex items-center">
							<input type="checkbox" bind:checked={verbose} class="rounded" />
							<span class="ml-2 text-sm">詳細出力 (-v)</span>
						</label>
						<label class="inline-flex items-center">
							<input type="checkbox" bind:checked={insecure} class="rounded" />
							<span class="ml-2 text-sm">SSL証明書検証をスキップ (-k)</span>
						</label>
					</div>
					<div class="flex items-center gap-3">
						<label class="text-sm">タイムアウト (秒):</label>
						<input
							type="number"
							bind:value={timeout}
							min="0"
							class="w-20 rounded border-gray-300 px-3 py-1 text-sm"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- 生成されたコマンド -->
		<div class="lg:col-span-1">
			<div class="sticky top-4 rounded-lg border border-gray-200 bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-medium text-gray-900">生成されたコマンド</h3>
					<button
						on:click={() => copyToClipboard(generatedCommand)}
						disabled={!url.trim()}
						class="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
					>
						<Icon icon="mdi:content-copy" class="mr-1 inline h-3 w-3" />
						コピー
					</button>
				</div>
				<pre
					class="rounded bg-gray-50 p-3 font-mono text-sm break-all whitespace-pre-wrap text-gray-900">{generatedCommand}</pre>
			</div>
		</div>
	</div>

	<!-- 説明 -->
	<div class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="flex items-start">
			<Icon icon="mdi:information-outline" class="mt-0.5 mr-2 h-5 w-5 text-blue-600" />
			<div class="text-sm text-blue-800">
				<p class="mb-2 font-medium">使用方法</p>
				<ul class="space-y-1 text-xs">
					<li>• 各項目を設定すると、リアルタイムでcurlコマンドが生成されます</li>
					<li>• プリセットを使用すると、よく使うパターンを素早く設定できます</li>
					<li>• 生成されたコマンドをコピーして、ターミナルで実行してください</li>
					<li>• JSONデータは「整形」ボタンで見やすくフォーマットできます</li>
				</ul>
			</div>
		</div>
	</div>
</div>
