<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	import type { DomainInfo } from './types';
	import {
		performSearch,
		formatDnsRecordsAsText,
		formatGeoInfoAsText,
		formatNetworkInfoAsText,
		formatSecurityInfoAsText,
		formatIPAnalysisAsText
	} from './whois-parser';

	const tool = tools.find((t) => t.name === 'whois-lookup');

	// 入力と状態
	let query = '';
	let isLoading = false;
	let error = '';
	let result: DomainInfo | null = null;

	// メインの検索関数
	async function performLookup() {
		if (!query.trim()) {
			error = '検索するドメインまたはIPアドレスを入力してください';
			return;
		}

		isLoading = true;
		error = '';
		result = null;

		try {
			result = await performSearch(query);
		} catch (err) {
			error = `検索中にエラーが発生しました: ${(err as Error).message}`;
		} finally {
			isLoading = false;
		}
	}

	// エンターキーでの検索
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			performLookup();
		}
	}

	// クリップボードコピー
	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('クリップボードへのコピーに失敗:', err);
		}
	}

	// 結果をテキスト形式で取得
	function getResultAsText(): string {
		if (!result) return '';

		let text = `=== ${result.isIP ? 'IP' : 'ドメイン'}情報: ${result.domain} ===\n`;
		if (result.isSubdomain && result.rootDomain) {
			text += `（サブドメイン / ルートドメイン: ${result.rootDomain}）\n`;
		}
		text += '\n';

		if (result.isIP && result.ipAnalysis) {
			text += '【IP解析】\n';
			text += formatIPAnalysisAsText(result.ipAnalysis);
			text += '\n';
		}

		if (result.isIP && result.ipGeoInfo) {
			const networkInfo = formatNetworkInfoAsText(result.ipGeoInfo);
			if (networkInfo) {
				text += '【ネットワーク情報】\n';
				text += networkInfo;
				text += '\n';
			}
		}

		if (result.isIP && result.ipGeoInfo) {
			const securityInfo = formatSecurityInfoAsText(result.ipGeoInfo);
			if (securityInfo) {
				text += '【セキュリティ情報】\n';
				text += securityInfo;
				text += '\n';
			}
		}

		if (result.ipGeoInfo) {
			text += result.isSubdomain ? `【${result.domain} の地理情報】\n` : '【地理情報】\n';
			text += formatGeoInfoAsText(result.ipGeoInfo);
			text += '\n';
		}

		if (result.isSubdomain && result.rootIpGeoInfo) {
			text += `【${result.rootDomain} の地理情報（ルートドメイン）】\n`;
			text += formatGeoInfoAsText(result.rootIpGeoInfo);
			text += '\n';
		}

		if (result.dnsRecords.length > 0) {
			text += result.isSubdomain ? `【${result.domain} のDNSレコード】\n` : '【DNSレコード】\n';
			text += formatDnsRecordsAsText(result.dnsRecords);
		}

		if (result.isSubdomain && result.rootDnsRecords && result.rootDnsRecords.length > 0) {
			text += `【${result.rootDomain} のDNSレコード（ルートドメイン）】\n`;
			text += formatDnsRecordsAsText(result.rootDnsRecords);
		}

		return text;
	}

	const sampleDomains = [
		'google.com',
		'www.github.com',
		'api.cloudflare.com',
		'docs.aws.amazon.com',
		'8.8.8.8'
	];

	function loadSample(domain: string) {
		query = domain;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 検索入力 -->
	<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6">
		<div class="mb-4">
			<label for="query-input" class="mb-2 block text-sm font-medium text-gray-700">
				ドメイン名またはIPアドレス
			</label>
			<div class="flex gap-3">
				<input
					id="query-input"
					type="text"
					bind:value={query}
					on:keydown={handleKeydown}
					placeholder="例: google.com, www.github.com, api.example.co.jp, 8.8.8.8"
					class="flex-1 rounded border-gray-300 px-4 py-2 font-mono text-sm"
				/>
				<button
					on:click={performLookup}
					disabled={isLoading || !query.trim()}
					class="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isLoading}
						<div class="flex items-center">
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							検索中...
						</div>
					{:else}
						<Icon icon="mdi:magnify" class="mr-2 inline h-4 w-4" />
						検索
					{/if}
				</button>
			</div>
		</div>

		<!-- サンプルボタン -->
		<div class="flex flex-wrap gap-2">
			<span class="text-sm text-gray-600">サンプル:</span>
			{#each sampleDomains as domain (domain)}
				<button
					on:click={() => loadSample(domain)}
					class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
				>
					{domain}
				</button>
			{/each}
		</div>
	</div>

	<!-- エラー表示 -->
	{#if error}
		<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
			<Icon icon="mdi:alert-circle" class="mr-2 inline h-5 w-5" />
			{error}
		</div>
	{/if}

	<!-- 結果表示 -->
	{#if result}
		<div class="space-y-6">
			<!-- 基本情報 -->
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900">
						{result.isIP ? 'IP情報' : 'ドメイン情報'}
					</h2>
					<button
						on:click={() => copyToClipboard(getResultAsText())}
						class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
					>
						<Icon icon="mdi:content-copy" class="mr-2 inline h-4 w-4" />
						すべてコピー
					</button>
				</div>

				<div class="mb-4 rounded bg-gray-50 p-4">
					<div class="font-mono text-2xl text-gray-900">{result.domain}</div>
					<div class="flex flex-wrap items-center gap-2 text-sm text-gray-600">
						{result.isIP ? 'IPアドレス' : 'ドメイン名'}
						{#if result.isSubdomain}
							<span class="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
								サブドメイン
							</span>
						{/if}
						{#if result.isIP && result.ipAnalysis}
							<span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
								{result.ipAnalysis.version}
							</span>
							{#if result.ipAnalysis.isPrivate}
								<span class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
									プライベート
								</span>
							{:else if !result.ipAnalysis.isLoopback && !result.ipAnalysis.isLinkLocal}
								<span class="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
									パブリック
								</span>
							{/if}
							{#if result.ipAnalysis.isLoopback}
								<span class="rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
									ループバック
								</span>
							{/if}
							{#if result.ipAnalysis.isLinkLocal}
								<span class="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
									リンクローカル
								</span>
							{/if}
							{#if result.ipAnalysis.isMulticast}
								<span class="rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
									マルチキャスト
								</span>
							{/if}
							{#if result.ipAnalysis.ipClass}
								<span class="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
									Class {result.ipAnalysis.ipClass}
								</span>
							{/if}
						{/if}
					</div>
				</div>

				{#if result.isSubdomain && result.rootDomain}
					<div class="rounded border border-purple-200 bg-purple-50 p-4">
						<div class="flex items-center gap-2 text-sm">
							<Icon icon="mdi:arrow-right" class="h-4 w-4 text-purple-600" />
							<span class="text-purple-700">ルートドメイン:</span>
							<button
								on:click={() => {
									if (result?.rootDomain) {
										query = result.rootDomain;
										performLookup();
									}
								}}
								class="font-mono font-medium text-purple-800 underline hover:text-purple-900"
								aria-label={`ルートドメイン ${result.rootDomain} を検索`}
							>
								{result.rootDomain}
							</button>
						</div>
						<p class="mt-1 text-xs text-purple-600">
							※ WHOISなどのドメイン登録情報はルートドメインで確認できます
						</p>
					</div>
				{/if}
			</div>

			<!-- ネットワーク情報（IPの場合） -->
			{#if result.isIP && result.ipGeoInfo && (result.ipGeoInfo.as || result.ipGeoInfo.isp || result.ipGeoInfo.reverse)}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center">
						<Icon icon="mdi:lan" class="mr-2 h-6 w-6 text-cyan-600" />
						<h3 class="text-lg font-semibold text-gray-900">ネットワーク情報</h3>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#if result.ipGeoInfo.as}
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">ASN:</span>
								<span class="font-mono text-gray-900">{result.ipGeoInfo.as}</span>
							</div>
						{/if}
						{#if result.ipGeoInfo.asname}
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">AS組織名:</span>
								<span class="text-gray-900">{result.ipGeoInfo.asname}</span>
							</div>
						{/if}
						{#if result.ipGeoInfo.isp}
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">ISP:</span>
								<span class="text-gray-900">{result.ipGeoInfo.isp}</span>
							</div>
						{/if}
						{#if result.ipGeoInfo.reverse}
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">逆引きホスト名:</span>
								<span class="font-mono text-gray-900">{result.ipGeoInfo.reverse}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- セキュリティ情報（IPの場合） -->
			{#if result.isIP && result.ipGeoInfo && (result.ipGeoInfo.proxy !== undefined || result.ipGeoInfo.mobile !== undefined || result.ipGeoInfo.hosting !== undefined)}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center">
						<Icon icon="mdi:shield-check" class="mr-2 h-6 w-6 text-amber-600" />
						<h3 class="text-lg font-semibold text-gray-900">セキュリティ情報</h3>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						{#if result.ipGeoInfo.proxy !== undefined}
							<div
								class="flex items-center justify-between rounded-lg border p-4 {result.ipGeoInfo
									.proxy
									? 'border-red-200 bg-red-50'
									: 'border-green-200 bg-green-50'}"
							>
								<div class="flex items-center">
									<Icon
										icon={result.ipGeoInfo.proxy ? 'mdi:shield-alert' : 'mdi:shield-check'}
										class="mr-2 h-5 w-5 {result.ipGeoInfo.proxy
											? 'text-red-600'
											: 'text-green-600'}"
									/>
									<span
										class="font-medium {result.ipGeoInfo.proxy ? 'text-red-800' : 'text-green-800'}"
										>プロキシ/VPN</span
									>
								</div>
								<span
									class="text-sm font-bold {result.ipGeoInfo.proxy
										? 'text-red-700'
										: 'text-green-700'}"
								>
									{result.ipGeoInfo.proxy ? '検出' : '未検出'}
								</span>
							</div>
						{/if}
						{#if result.ipGeoInfo.mobile !== undefined}
							<div
								class="flex items-center justify-between rounded-lg border p-4 {result.ipGeoInfo
									.mobile
									? 'border-blue-200 bg-blue-50'
									: 'border-gray-200 bg-gray-50'}"
							>
								<div class="flex items-center">
									<Icon
										icon="mdi:cellphone"
										class="mr-2 h-5 w-5 {result.ipGeoInfo.mobile
											? 'text-blue-600'
											: 'text-gray-500'}"
									/>
									<span
										class="font-medium {result.ipGeoInfo.mobile
											? 'text-blue-800'
											: 'text-gray-700'}">モバイル回線</span
									>
								</div>
								<span
									class="text-sm font-bold {result.ipGeoInfo.mobile
										? 'text-blue-700'
										: 'text-gray-600'}"
								>
									{result.ipGeoInfo.mobile ? 'はい' : 'いいえ'}
								</span>
							</div>
						{/if}
						{#if result.ipGeoInfo.hosting !== undefined}
							<div
								class="flex items-center justify-between rounded-lg border p-4 {result.ipGeoInfo
									.hosting
									? 'border-purple-200 bg-purple-50'
									: 'border-gray-200 bg-gray-50'}"
							>
								<div class="flex items-center">
									<Icon
										icon="mdi:server"
										class="mr-2 h-5 w-5 {result.ipGeoInfo.hosting
											? 'text-purple-600'
											: 'text-gray-500'}"
									/>
									<span
										class="font-medium {result.ipGeoInfo.hosting
											? 'text-purple-800'
											: 'text-gray-700'}">ホスティング/DC</span
									>
								</div>
								<span
									class="text-sm font-bold {result.ipGeoInfo.hosting
										? 'text-purple-700'
										: 'text-gray-600'}"
								>
									{result.ipGeoInfo.hosting ? 'はい' : 'いいえ'}
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- 技術的詳細（IPの場合） -->
			{#if result.isIP && result.ipAnalysis && (result.ipAnalysis.binary || result.ipAnalysis.hex)}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center">
						<Icon icon="mdi:code-braces" class="mr-2 h-6 w-6 text-gray-600" />
						<h3 class="text-lg font-semibold text-gray-900">技術的詳細</h3>
					</div>

					<div class="space-y-3">
						{#if result.ipAnalysis.binary}
							<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
								<span class="font-medium text-gray-700">バイナリ表現:</span>
								<div class="flex items-center gap-2">
									<code class="rounded bg-gray-100 px-3 py-1 font-mono text-sm text-gray-900"
										>{result.ipAnalysis.binary}</code
									>
									<button
										on:click={() =>
											result?.ipAnalysis?.binary && copyToClipboard(result.ipAnalysis.binary)}
										class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
									>
										<Icon icon="mdi:content-copy" class="h-3 w-3" />
									</button>
								</div>
							</div>
						{/if}
						{#if result.ipAnalysis.hex}
							<div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
								<span class="font-medium text-gray-700">16進数表現:</span>
								<div class="flex items-center gap-2">
									<code class="rounded bg-gray-100 px-3 py-1 font-mono text-sm text-gray-900"
										>{result.ipAnalysis.hex}</code
									>
									<button
										on:click={() =>
											result?.ipAnalysis?.hex && copyToClipboard(result.ipAnalysis.hex)}
										class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
									>
										<Icon icon="mdi:content-copy" class="h-3 w-3" />
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- 地理情報（IPの場合） -->
			{#if result.ipGeoInfo}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:earth" class="mr-2 h-6 w-6 text-blue-600" />
							<h3 class="text-lg font-semibold text-gray-900">
								{result.isSubdomain ? `${result.domain} の地理情報` : '地理情報'}
							</h3>
						</div>
						<button
							on:click={() => copyToClipboard(JSON.stringify(result?.ipGeoInfo, null, 2))}
							class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
						>
							<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
						</button>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-3">
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">IPアドレス:</span>
								<span class="font-mono text-gray-900">{result.ipGeoInfo.ip}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">国/地域:</span>
								<span class="text-gray-900"
									>{result.ipGeoInfo.country} ({result.ipGeoInfo.countryCode})</span
								>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">州/県:</span>
								<span class="text-gray-900">{result.ipGeoInfo.region}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">都市:</span>
								<span class="text-gray-900">{result.ipGeoInfo.city}</span>
							</div>
						</div>
						<div class="space-y-3">
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">タイムゾーン:</span>
								<span class="text-gray-900">{result.ipGeoInfo.timezone}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">郵便番号:</span>
								<span class="text-gray-900">{result.ipGeoInfo.postal}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">緯度経度:</span>
								<span class="font-mono text-gray-900"
									>{result.ipGeoInfo.latitude}, {result.ipGeoInfo.longitude}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">組織:</span>
								<span class="text-sm text-gray-900">{result.ipGeoInfo.org}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- ルートドメインの地理情報（サブドメインと異なるIPの場合） -->
			{#if result.isSubdomain && result.rootIpGeoInfo}
				<div class="rounded-lg border border-purple-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:earth" class="mr-2 h-6 w-6 text-purple-600" />
							<h3 class="text-lg font-semibold text-gray-900">
								{result.rootDomain} の地理情報
							</h3>
							<span class="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
								ルートドメイン
							</span>
						</div>
						<button
							on:click={() => copyToClipboard(JSON.stringify(result?.rootIpGeoInfo, null, 2))}
							class="rounded bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
						>
							<Icon icon="mdi:content-copy" class="inline h-3 w-3" />
						</button>
					</div>

					<div class="mb-3 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
						<Icon icon="mdi:information-outline" class="mr-1 inline h-4 w-4" />
						サブドメインとルートドメインでIPアドレスが異なります
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div class="space-y-3">
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">IPアドレス:</span>
								<span class="font-mono text-gray-900">{result.rootIpGeoInfo.ip}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">国/地域:</span>
								<span class="text-gray-900"
									>{result.rootIpGeoInfo.country} ({result.rootIpGeoInfo.countryCode})</span
								>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">州/県:</span>
								<span class="text-gray-900">{result.rootIpGeoInfo.region}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">都市:</span>
								<span class="text-gray-900">{result.rootIpGeoInfo.city}</span>
							</div>
						</div>
						<div class="space-y-3">
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">タイムゾーン:</span>
								<span class="text-gray-900">{result.rootIpGeoInfo.timezone}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">郵便番号:</span>
								<span class="text-gray-900">{result.rootIpGeoInfo.postal}</span>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">緯度経度:</span>
								<span class="font-mono text-gray-900"
									>{result.rootIpGeoInfo.latitude}, {result.rootIpGeoInfo.longitude}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="font-medium text-gray-700">組織:</span>
								<span class="text-sm text-gray-900">{result.rootIpGeoInfo.org}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- DNSレコード -->
			{#if result.dnsRecords.length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:dns" class="mr-2 h-6 w-6 text-green-600" />
							<h3 class="text-lg font-semibold text-gray-900">
								{result.isSubdomain ? `${result.domain} のDNSレコード` : 'DNSレコード'}
							</h3>
						</div>
						<div class="text-sm text-gray-500">
							{result.dnsRecords.length} 件
						</div>
					</div>

					<!-- レコードタイプ別にグループ化して表示 -->
					<div class="space-y-4">
						{#each Object.entries(groupRecordsByType(result.dnsRecords)) as [type, records] (type)}
							<div class="rounded border border-gray-100 bg-gray-50 p-4">
								<h4 class="mb-3 font-medium text-gray-800">{type} レコード ({records.length}件)</h4>
								<div class="space-y-2">
									{#each records as record, idx (record.type + record.name + record.data + idx)}
										<div
											class="flex flex-col gap-2 rounded bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
										>
											<div class="min-w-0 flex-1 font-mono text-sm break-all text-gray-900">
												{record.data}
											</div>
											<div class="flex shrink-0 items-center gap-2">
												{#if record.ttl}
													<span class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700">
														TTL: {record.ttl}s
													</span>
												{/if}
												<button
													on:click={() => copyToClipboard(record.data)}
													class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
												>
													<Icon icon="mdi:content-copy" class="h-3 w-3" />
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else if result && !result.isIP}
				<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
					<Icon icon="mdi:alert" class="mr-2 inline h-5 w-5" />
					このドメインのDNSレコードが見つかりませんでした
				</div>
			{/if}

			<!-- ルートドメインのDNSレコード（サブドメインの場合） -->
			{#if result.isSubdomain && result.rootDnsRecords && result.rootDnsRecords.length > 0}
				<div class="rounded-lg border border-purple-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:dns" class="mr-2 h-6 w-6 text-purple-600" />
							<h3 class="text-lg font-semibold text-gray-900">
								{result.rootDomain} のDNSレコード
							</h3>
							<span class="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
								ルートドメイン
							</span>
						</div>
						<div class="text-sm text-gray-500">
							{result.rootDnsRecords.length} 件
						</div>
					</div>

					<div class="mb-3 rounded bg-gray-100 p-3 text-sm text-gray-700">
						<Icon icon="mdi:information-outline" class="mr-1 inline h-4 w-4" />
						NS/MXなどのドメイン管理レコードはルートドメインで確認できます
					</div>

					<!-- レコードタイプ別にグループ化して表示 -->
					<div class="space-y-4">
						{#each Object.entries(groupRecordsByType(result.rootDnsRecords)) as [type, records] (type)}
							<div class="rounded border border-purple-100 bg-purple-50/50 p-4">
								<h4 class="mb-3 font-medium text-gray-800">{type} レコード ({records.length}件)</h4>
								<div class="space-y-2">
									{#each records as record, idx (record.type + record.name + record.data + idx)}
										<div
											class="flex flex-col gap-2 rounded bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
										>
											<div class="min-w-0 flex-1 font-mono text-sm break-all text-gray-900">
												{record.data}
											</div>
											<div class="flex shrink-0 items-center gap-2">
												{#if record.ttl}
													<span class="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
														TTL: {record.ttl}s
													</span>
												{/if}
												<button
													on:click={() => copyToClipboard(record.data)}
													class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
												>
													<Icon icon="mdi:content-copy" class="h-3 w-3" />
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{:else if !isLoading}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
			<Icon icon="mdi:dns" class="mx-auto mb-3 h-12 w-12" />
			<p class="mb-2">ドメインまたはIPアドレスを入力して検索してください</p>
			<p class="text-sm">DNS情報、IP地理情報を取得できます</p>
		</div>
	{/if}

	<!-- 注意事項 -->
	<div class="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
		<div class="flex items-start">
			<Icon icon="mdi:information-outline" class="mt-0.5 mr-2 h-5 w-5 text-blue-600" />
			<div class="text-sm text-blue-800">
				<p class="mb-2 font-medium">機能について</p>
				<ul class="space-y-1 text-xs">
					<li>• DNS情報はCloudflare DNS-over-HTTPSから取得されます</li>
					<li>• IP地理情報はip-api.comから取得されます</li>
					<li>
						• <strong>サブドメイン対応:</strong> www.example.comなどのサブドメインも検索可能です
					</li>
					<li>• サブドメインの場合、ルートドメインのDNS情報も同時に取得・表示します</li>
					<li>• CNAMEレコードのみのサブドメインも、IPアドレスを自動解決します</li>
					<li>• ブラウザの制限により、直接のWhois情報取得は行えません</li>
					<li>• 対応レコードタイプ: A, AAAA, MX, NS, TXT, CNAME</li>
				</ul>
			</div>
		</div>
	</div>
</div>
