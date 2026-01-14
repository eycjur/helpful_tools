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
		isSubdomain: boolean;
		rootDomain?: string;
		dnsRecords: DNSRecord[];
		rootDnsRecords?: DNSRecord[]; // ルートドメインのDNS（サブドメインの場合のみ）
		ipGeoInfo?: IPGeoInfo;
		rootIpGeoInfo?: IPGeoInfo; // ルートドメインのIP地理情報（異なる場合）
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
		// サブドメインを含むドメイン名を許容（例: www.example.com, api.staging.example.com）
		// RFC 1035に準拠: 各ラベルは63文字以下、全体は253文字以下
		if (input.length > 253) return false;

		// 各ラベルの長さを検証
		const labels = input.split('.');
		if (labels.some((label) => label.length > 63 || label.length === 0)) return false;

		const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
		return domainRegex.test(input);
	}

	// 2レベルTLD（ccSLD）のリスト
	// 注意: これは完全なリストではなく、よく使われるものをカバーしています
	// 正確なルートドメイン抽出が必要な場合は、Public Suffix Listの使用を検討してください
	// https://publicsuffix.org/
	const twoLevelTLDs = new Set([
		// 日本
		'co.jp',
		'ne.jp',
		'or.jp',
		'ac.jp',
		'go.jp',
		'ed.jp',
		'gr.jp',
		'ad.jp',
		'lg.jp',
		// イギリス
		'co.uk',
		'org.uk',
		'me.uk',
		'ac.uk',
		'gov.uk',
		'net.uk',
		'sch.uk',
		// オーストラリア
		'com.au',
		'net.au',
		'org.au',
		'edu.au',
		'gov.au',
		'asn.au',
		'id.au',
		// ニュージーランド
		'co.nz',
		'net.nz',
		'org.nz',
		'govt.nz',
		'ac.nz',
		'school.nz',
		'geek.nz',
		// 中国
		'com.cn',
		'net.cn',
		'org.cn',
		'gov.cn',
		'edu.cn',
		'ac.cn',
		// 韓国
		'co.kr',
		'ne.kr',
		'or.kr',
		'go.kr',
		're.kr',
		'pe.kr',
		'ac.kr',
		// ブラジル
		'com.br',
		'net.br',
		'org.br',
		'gov.br',
		'edu.br',
		// インド
		'co.in',
		'net.in',
		'org.in',
		'gov.in',
		'ac.in',
		'res.in',
		// その他
		'com.tw',
		'org.tw',
		'net.tw',
		'gov.tw',
		'com.hk',
		'org.hk',
		'net.hk',
		'gov.hk',
		'edu.hk',
		'com.sg',
		'org.sg',
		'net.sg',
		'gov.sg',
		'edu.sg',
		'co.th',
		'or.th',
		'ac.th',
		'go.th',
		'in.th',
		'mi.th',
		'net.th',
		'com.my',
		'net.my',
		'org.my',
		'gov.my',
		'edu.my',
		'co.id',
		'or.id',
		'ac.id',
		'go.id',
		'net.id',
		'web.id',
		'com.ph',
		'net.ph',
		'org.ph',
		'gov.ph',
		'edu.ph',
		'co.za',
		'org.za',
		'net.za',
		'gov.za',
		'ac.za',
		'com.mx',
		'org.mx',
		'net.mx',
		'gob.mx',
		'edu.mx',
		'com.ar',
		'net.ar',
		'org.ar',
		'gov.ar',
		'edu.ar',
		'co.il',
		'org.il',
		'net.il',
		'ac.il',
		'gov.il',
		'muni.il',
		'co.ke',
		'or.ke',
		'ne.ke',
		'go.ke',
		'ac.ke',
		'com.ng',
		'org.ng',
		'net.ng',
		'gov.ng',
		'edu.ng',
		'com.eg',
		'org.eg',
		'net.eg',
		'gov.eg',
		'edu.eg',
		'com.pk',
		'org.pk',
		'net.pk',
		'gov.pk',
		'edu.pk',
		'com.bd',
		'org.bd',
		'net.bd',
		'gov.bd',
		'edu.bd',
		'com.vn',
		'org.vn',
		'net.vn',
		'gov.vn',
		'edu.vn',
		'co.ve',
		'com.ve',
		'net.ve',
		'org.ve',
		'edu.ve',
		'gob.ve',
		'com.co',
		'net.co',
		'org.co',
		'gov.co',
		'edu.co',
		'mil.co'
	]);

	// ルートドメイン（登録可能ドメイン）を抽出
	function extractRootDomain(domain: string): string {
		const parts = domain.toLowerCase().split('.');
		if (parts.length <= 2) return domain;

		// 最後の2パーツが2レベルTLDかチェック
		const lastTwo = parts.slice(-2).join('.');
		if (twoLevelTLDs.has(lastTwo)) {
			// 2レベルTLDの場合、最後の3パーツを返す
			return parts.slice(-3).join('.');
		}

		// 通常のTLDの場合、最後の2パーツを返す
		return parts.slice(-2).join('.');
	}

	// サブドメインかどうか判定
	function isSubdomain(domain: string): boolean {
		const rootDomain = extractRootDomain(domain);
		return domain.toLowerCase() !== rootDomain;
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

	// IP地理情報取得（ip-api.comを使用 - CORS対応）
	async function fetchIPGeolocation(ip: string): Promise<IPGeoInfo | null> {
		try {
			// ip-api.comはCORSに対応しており、HTTPでのリクエストが必要（無料プラン）
			const response = await fetch(
				`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,query`
			);
			if (!response.ok) throw new Error('IP geolocation query failed');

			const data = await response.json();
			if (data.status === 'fail') {
				throw new Error(data.message || 'IP lookup failed');
			}

			return {
				ip: data.query || ip,
				city: data.city || 'Unknown',
				region: data.regionName || 'Unknown',
				country: data.country || 'Unknown',
				countryCode: data.countryCode || 'Unknown',
				timezone: data.timezone || 'Unknown',
				latitude: data.lat || 0,
				longitude: data.lon || 0,
				org: data.org || data.isp || 'Unknown',
				postal: data.zip || 'Unknown'
			};
		} catch (err) {
			console.error('IP geolocation error:', err);
			return null;
		}
	}

	// ドメインのDNSレコードとIP地理情報を取得するヘルパー関数
	async function fetchDomainInfo(domain: string): Promise<{
		dnsRecords: DNSRecord[];
		ipGeoInfo?: IPGeoInfo;
		resolvedIP?: string;
	}> {
		const dnsRecords: DNSRecord[] = [];

		// 複数のDNSレコードタイプを並列で取得
		const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
		const promises = recordTypes.map((type) => queryDNSOverHTTPS(domain, type));
		const results = await Promise.all(promises);

		// 結果をマージ
		results.forEach((records) => dnsRecords.push(...records));

		// IPアドレスを取得（Aレコードがない場合はCNAMEを解決）
		const aRecords = dnsRecords.filter((r) => r.type === 'A');
		let resolvedIP: string | undefined;
		let ipGeoInfo: IPGeoInfo | undefined;

		if (aRecords.length > 0) {
			// 直接Aレコードがある場合
			resolvedIP = aRecords[0].data;
		} else {
			// CNAMEがある場合、CNAMEの先を解決してAレコードを取得
			const cnameRecords = dnsRecords.filter((r) => r.type === 'CNAME');
			if (cnameRecords.length > 0) {
				// CNAMEの先のAレコードを取得（最大3段階まで追跡）
				let targetDomain = cnameRecords[0].data.replace(/\.$/, ''); // 末尾のドットを除去
				for (let i = 0; i < 3 && !resolvedIP; i++) {
					const cnameARecords = await queryDNSOverHTTPS(targetDomain, 'A');
					if (cnameARecords.length > 0) {
						resolvedIP = cnameARecords[0].data;
						// 解決されたAレコードも追加（参考情報として）
						dnsRecords.push(
							...cnameARecords.map((r) => ({
								...r,
								name: `${r.name} (via CNAME)`
							}))
						);
					} else {
						// さらにCNAMEがある場合は追跡
						const nextCname = await queryDNSOverHTTPS(targetDomain, 'CNAME');
						if (nextCname.length > 0) {
							targetDomain = nextCname[0].data.replace(/\.$/, '');
						} else {
							break;
						}
					}
				}
			}
		}

		// IP地理情報を取得
		if (resolvedIP) {
			ipGeoInfo = (await fetchIPGeolocation(resolvedIP)) || undefined;
		}

		return { dnsRecords, ipGeoInfo, resolvedIP };
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
					isSubdomain: false,
					dnsRecords: [],
					ipGeoInfo: geoInfo || undefined
				};
			} else {
				// ドメイン名の場合
				const isSub = isSubdomain(cleanQuery);
				const rootDomain = extractRootDomain(cleanQuery);

				// サブドメインのDNS情報を取得
				const { dnsRecords, ipGeoInfo } = await fetchDomainInfo(cleanQuery);

				let rootDnsRecords: DNSRecord[] | undefined;
				let rootIpGeoInfo: IPGeoInfo | undefined;

				// サブドメインの場合、ルートドメインの情報も取得
				if (isSub) {
					const rootInfo = await fetchDomainInfo(rootDomain);
					rootDnsRecords = rootInfo.dnsRecords;

					// ルートドメインのIPがサブドメインと異なる場合のみ保存
					const subdomainIP = ipGeoInfo?.ip;
					const rootIP = rootInfo.ipGeoInfo?.ip;
					if (rootIP && rootIP !== subdomainIP) {
						rootIpGeoInfo = rootInfo.ipGeoInfo;
					}
				}

				result = {
					domain: cleanQuery,
					isIP: false,
					isSubdomain: isSub,
					rootDomain: isSub ? rootDomain : undefined,
					dnsRecords,
					rootDnsRecords,
					ipGeoInfo,
					rootIpGeoInfo
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

	// DNSレコードをテキスト形式で取得するヘルパー
	function formatDnsRecordsAsText(records: DNSRecord[]): string {
		let text = '';
		const groupedRecords = groupRecordsByType(records);

		// 各タイプのレコードを表示
		Object.entries(groupedRecords).forEach(([type, recs]) => {
			text += `${type}レコード:\n`;
			recs.forEach((record) => {
				text += `  ${record.data}${record.ttl ? ` (TTL: ${record.ttl}s)` : ''}\n`;
			});
			text += '\n';
		});

		return text;
	}

	// 地理情報をテキスト形式で取得するヘルパー
	function formatGeoInfoAsText(geoInfo: IPGeoInfo): string {
		let text = '';
		text += `IPアドレス: ${geoInfo.ip}\n`;
		text += `国/地域: ${geoInfo.country} (${geoInfo.countryCode})\n`;
		text += `州/県: ${geoInfo.region}\n`;
		text += `都市: ${geoInfo.city}\n`;
		text += `組織: ${geoInfo.org}\n`;
		text += `タイムゾーン: ${geoInfo.timezone}\n`;
		text += `緯度経度: ${geoInfo.latitude}, ${geoInfo.longitude}\n`;
		return text;
	}

	// 結果をテキスト形式で取得
	function getResultAsText(): string {
		if (!result) return '';

		let text = `=== ${result.isIP ? 'IP' : 'ドメイン'}情報: ${result.domain} ===\n`;
		if (result.isSubdomain && result.rootDomain) {
			text += `（サブドメイン / ルートドメイン: ${result.rootDomain}）\n`;
		}
		text += '\n';

		// サブドメイン/ドメインの地理情報
		if (result.ipGeoInfo) {
			text += result.isSubdomain ? `【${result.domain} の地理情報】\n` : '【地理情報】\n';
			text += formatGeoInfoAsText(result.ipGeoInfo);
			text += '\n';
		}

		// ルートドメインの地理情報（異なる場合）
		if (result.isSubdomain && result.rootIpGeoInfo) {
			text += `【${result.rootDomain} の地理情報（ルートドメイン）】\n`;
			text += formatGeoInfoAsText(result.rootIpGeoInfo);
			text += '\n';
		}

		// サブドメイン/ドメインのDNSレコード
		if (result.dnsRecords.length > 0) {
			text += result.isSubdomain ? `【${result.domain} のDNSレコード】\n` : '【DNSレコード】\n';
			text += formatDnsRecordsAsText(result.dnsRecords);
		}

		// ルートドメインのDNSレコード
		if (result.isSubdomain && result.rootDnsRecords && result.rootDnsRecords.length > 0) {
			text += `【${result.rootDomain} のDNSレコード（ルートドメイン）】\n`;
			text += formatDnsRecordsAsText(result.rootDnsRecords);
		}

		return text;
	}

	// サンプルドメイン（サブドメイン例も追加）
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
					<div class="flex items-center gap-2 text-sm text-gray-600">
						{result.isIP ? 'IPアドレス' : 'ドメイン名'}
						{#if result.isSubdomain}
							<span class="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
								サブドメイン
							</span>
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
										<div class="flex items-center justify-between rounded bg-white p-3">
											<div class="font-mono text-sm text-gray-900">
												{record.data}
											</div>
											<div class="flex items-center gap-2">
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
