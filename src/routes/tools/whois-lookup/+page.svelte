<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'whois-lookup');

	// 入力と状態
	let query = '';
	let isLoading = false;
	let error = '';

	// 結果データ型定義
	interface DNSRecord {
		name: string;
		type: string;
		data: string;
		ttl?: number;
	}

	interface IPGeoInfo {
		ip: string;
		city: string;
		region: string;
		country: string;
		countryCode: string;
		timezone: string;
		latitude: number;
		longitude: number;
		org: string;
		postal: string;
	}

	interface DomainInfo {
		domain: string;
		isIP: boolean;
		dnsRecords: DNSRecord[];
		ipGeoInfo?: IPGeoInfo;
		registrationInfo?: Record<string, unknown>;
		error?: string;
	}

	let result: DomainInfo | null = null;

	// ドメイン・IP判定
	function isIPAddress(input: string): boolean {
		const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
		const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
		return ipv4Regex.test(input) || ipv6Regex.test(input);
	}

	function isDomainName(input: string): boolean {
		const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
		return domainRegex.test(input);
	}

	// DNS-over-HTTPS クエリ
	async function queryDNSOverHTTPS(domain: string, recordType: string): Promise<DNSRecord[]> {
		try {
			// Cloudflare DNS-over-HTTPS
			const response = await fetch(
				`https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=${recordType}`,
				{
					headers: {
						Accept: 'application/dns-json'
					}
				}
			);

			if (!response.ok) {
				throw new Error(`DNS query failed: ${response.status}`);
			}

			const data = await response.json();

			if (data.Answer) {
				return data.Answer.map(
					(answer: { name: string; type: number; data: string; TTL: number }) => ({
						name: answer.name,
						type: getRecordTypeName(answer.type),
						data: answer.data,
						ttl: answer.TTL
					})
				);
			}

			return [];
		} catch (err) {
			console.error(`DNS query error for ${recordType}:`, err);
			return [];
		}
	}

	// DNS レコードタイプ番号を名前に変換
	function getRecordTypeName(type: number): string {
		const typeMap: { [key: number]: string } = {
			1: 'A',
			2: 'NS',
			5: 'CNAME',
			6: 'SOA',
			15: 'MX',
			16: 'TXT',
			28: 'AAAA',
			257: 'CAA'
		};
		return typeMap[type] || `TYPE${type}`;
	}

	// IP地理情報取得
	async function fetchIPGeolocation(ip: string): Promise<IPGeoInfo | null> {
		try {
			const response = await fetch(`https://ipapi.co/${ip}/json/`);
			if (!response.ok) throw new Error('IP geolocation query failed');

			const data = await response.json();
			return {
				ip: data.ip || ip,
				city: data.city || 'Unknown',
				region: data.region || 'Unknown',
				country: data.country_name || 'Unknown',
				countryCode: data.country_code || 'Unknown',
				timezone: data.timezone || 'Unknown',
				latitude: data.latitude || 0,
				longitude: data.longitude || 0,
				org: data.org || 'Unknown',
				postal: data.postal || 'Unknown'
			};
		} catch (err) {
			console.error('IP geolocation error:', err);
			return null;
		}
	}

	// メインの検索関数
	async function performLookup() {
		if (!query.trim()) {
			error = '検索するドメインまたはIPアドレスを入力してください';
			return;
		}

		const cleanQuery = query.trim().toLowerCase();

		// 入力形式の検証
		if (!isIPAddress(cleanQuery) && !isDomainName(cleanQuery)) {
			error = '有効なドメイン名またはIPアドレスを入力してください';
			return;
		}

		isLoading = true;
		error = '';
		result = null;

		try {
			const isIP = isIPAddress(cleanQuery);

			if (isIP) {
				// IPアドレスの場合
				const geoInfo = await fetchIPGeolocation(cleanQuery);
				result = {
					domain: cleanQuery,
					isIP: true,
					dnsRecords: [],
					ipGeoInfo: geoInfo || undefined
				};
			} else {
				// ドメイン名の場合
				const dnsRecords: DNSRecord[] = [];

				// 複数のDNSレコードタイプを並列で取得
				const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
				const promises = recordTypes.map((type) => queryDNSOverHTTPS(cleanQuery, type));
				const results = await Promise.all(promises);

				// 結果をマージ
				results.forEach((records) => dnsRecords.push(...records));

				// ドメインのIPアドレスがある場合、そのGeo情報も取得
				const aRecords = dnsRecords.filter((r) => r.type === 'A');
				let ipGeoInfo: IPGeoInfo | undefined;

				if (aRecords.length > 0) {
					// 最初のAレコードのIPでGeo情報を取得
					ipGeoInfo = (await fetchIPGeolocation(aRecords[0].data)) || undefined;
				}

				result = {
					domain: cleanQuery,
					isIP: false,
					dnsRecords,
					ipGeoInfo
				};
			}
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

	// DNSレコードをタイプ別にグループ化
	function groupRecordsByType(records: DNSRecord[]): { [key: string]: DNSRecord[] } {
		return records.reduce(
			(acc, record) => {
				if (!acc[record.type]) acc[record.type] = [];
				acc[record.type].push(record);
				return acc;
			},
			{} as { [key: string]: DNSRecord[] }
		);
	}

	// 結果をテキスト形式で取得
	function getResultAsText(): string {
		if (!result) return '';

		let text = `=== ${result.isIP ? 'IP' : 'ドメイン'}情報: ${result.domain} ===\n\n`;

		if (result.ipGeoInfo) {
			text += '【地理情報】\n';
			text += `IPアドレス: ${result.ipGeoInfo.ip}\n`;
			text += `国/地域: ${result.ipGeoInfo.country} (${result.ipGeoInfo.countryCode})\n`;
			text += `州/県: ${result.ipGeoInfo.region}\n`;
			text += `都市: ${result.ipGeoInfo.city}\n`;
			text += `組織: ${result.ipGeoInfo.org}\n`;
			text += `タイムゾーン: ${result.ipGeoInfo.timezone}\n`;
			text += `緯度経度: ${result.ipGeoInfo.latitude}, ${result.ipGeoInfo.longitude}\n\n`;
		}

		if (result.dnsRecords.length > 0) {
			text += '【DNSレコード】\n';
			const groupedRecords: { [key: string]: DNSRecord[] } = {};

			// レコードタイプ別にグループ化
			result.dnsRecords.forEach((record) => {
				if (!groupedRecords[record.type]) {
					groupedRecords[record.type] = [];
				}
				groupedRecords[record.type].push(record);
			});

			// 各タイプのレコードを表示
			Object.entries(groupedRecords).forEach(([type, records]) => {
				text += `${type}レコード:\n`;
				records.forEach((record) => {
					text += `  ${record.data}${record.ttl ? ` (TTL: ${record.ttl}s)` : ''}\n`;
				});
				text += '\n';
			});
		}

		return text;
	}

	// サンプルドメイン
	const sampleDomains = ['google.com', 'github.com', 'cloudflare.com', '8.8.8.8', '1.1.1.1'];

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
					placeholder="例: google.com, github.com, 8.8.8.8"
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
					<div class="text-sm text-gray-600">
						{result.isIP ? 'IPアドレス' : 'ドメイン名'}
					</div>
				</div>
			</div>

			<!-- 地理情報（IPの場合） -->
			{#if result.ipGeoInfo}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:earth" class="mr-2 h-6 w-6 text-blue-600" />
							<h3 class="text-lg font-semibold text-gray-900">地理情報</h3>
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

			<!-- DNSレコード -->
			{#if result.dnsRecords.length > 0}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center">
							<Icon icon="mdi:dns" class="mr-2 h-6 w-6 text-green-600" />
							<h3 class="text-lg font-semibold text-gray-900">DNSレコード</h3>
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
									{#each records as record (record.name + record.data)}
										<div class="flex items-center justify-between rounded bg-white p-3">
											<div class="font-mono text-sm text-gray-900">
												{record.data}
											</div>
											<div class="flex items-center gap-2">
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
					<li>• IP地理情報はipapi.coから取得されます</li>
					<li>• ブラウザの制限により、直接のWhois情報取得は行えません</li>
					<li>• 対応レコードタイプ: A, AAAA, MX, NS, TXT, CNAME</li>
				</ul>
			</div>
		</div>
	</div>
</div>
