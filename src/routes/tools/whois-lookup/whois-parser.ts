/**
 * Whois/ドメイン調査 - ドメイン・IP解析ロジック
 */

import type { DNSRecord, IPGeoInfo, IPAnalysis, DomainInfo } from './types';

// 2レベルTLD（ccSLD）のリスト
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
	// その他アジア
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
	'com.vn',
	'org.vn',
	'net.vn',
	'gov.vn',
	'edu.vn',
	// アフリカ
	'co.za',
	'org.za',
	'net.za',
	'gov.za',
	'ac.za',
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
	// 中東
	'co.il',
	'org.il',
	'net.il',
	'ac.il',
	'gov.il',
	'muni.il',
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
	// 南米
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

/**
 * IPアドレスかどうかを判定
 */
function isIPv4(input: string): boolean {
	if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) return false;
	const parts = input.split('.').map((p) => parseInt(p, 10));
	return parts.length === 4 && parts.every((p) => p >= 0 && p <= 255);
}

function normalizeIPv6(input: string): string | null {
	if (!input.includes(':') || /[^0-9a-f:.]/i.test(input)) return null;
	try {
		return new URL(`http://[${input}]/`).hostname.slice(1, -1);
	} catch {
		return null;
	}
}

export function isIPAddress(input: string): boolean {
	return isIPv4(input) || normalizeIPv6(input) !== null;
}

/**
 * ドメイン名かどうかを判定
 */
export function isDomainName(input: string): boolean {
	if (input.length > 253) return false;
	const labels = input.split('.');
	if (labels.some((label) => label.length > 63 || label.length === 0)) return false;
	const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
	return domainRegex.test(input);
}

/**
 * ルートドメインを抽出
 */
export function extractRootDomain(domain: string): string {
	const parts = domain.toLowerCase().split('.');
	if (parts.length <= 2) return parts.join('.');

	const lastTwo = parts.slice(-2).join('.');
	if (twoLevelTLDs.has(lastTwo)) {
		return parts.slice(-3).join('.');
	}

	return parts.slice(-2).join('.');
}

/**
 * サブドメインかどうかを判定
 */
export function isSubdomain(domain: string): boolean {
	const rootDomain = extractRootDomain(domain);
	return domain.toLowerCase() !== rootDomain;
}

/**
 * DNS-over-HTTPSでDNSレコードをクエリ
 */
export async function queryDNSOverHTTPS(domain: string, recordType: string): Promise<DNSRecord[]> {
	try {
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

		if (data.Status === 3) return []; // NXDOMAIN
		if (data.Status) throw new Error(`DNS query failed: Status ${data.Status}`);

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
		throw new Error('DNS情報を取得できませんでした');
	}
}

/**
 * DNS レコードタイプ番号を名前に変換
 */
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

/**
 * IP地理情報を取得
 */
export async function fetchIPGeolocation(ip: string): Promise<IPGeoInfo | null> {
	try {
		const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
		if (!response.ok) throw new Error('IP geolocation query failed');

		const data = await response.json();
		if (data.error) {
			throw new Error(data.reason || 'IP lookup failed');
		}

		return {
			ip: data.ip || ip,
			city: data.city || 'Unknown',
			region: data.region || 'Unknown',
			country: data.country_name || 'Unknown',
			countryCode: data.country_code || 'Unknown',
			timezone: data.timezone || 'Unknown',
			latitude: data.latitude ?? null,
			longitude: data.longitude ?? null,
			org: data.org || 'Unknown',
			postal: data.postal || 'Unknown',
			as: data.asn || undefined,
			asname: data.org || undefined,
			reverse: data.hostname || undefined
		};
	} catch (err) {
		console.error('IP geolocation error:', err);
		return null;
	}
}

/**
 * IPアドレスを解析
 */
export function analyzeIP(ip: string): IPAnalysis | null {
	const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
	const match = ip.match(ipv4Regex);

	if (match) {
		const parts = [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
		const first = parts[0];

		if (parts.some((p) => p > 255)) return null;

		return {
			version: 'IPv4',
			isPrivate:
				first === 10 ||
				(first === 172 && parts[1] >= 16 && parts[1] <= 31) ||
				(first === 192 && parts[1] === 168),
			isLoopback: first === 127,
			isLinkLocal: first === 169 && parts[1] === 254,
			isMulticast: first >= 224 && first <= 239,
			ipClass: first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D' : 'E',
			binary: parts.map((p) => p.toString(2).padStart(8, '0')).join('.'),
			hex: parts.map((p) => p.toString(16).padStart(2, '0').toUpperCase()).join('')
		};
	}

	const ipv6 = normalizeIPv6(ip);
	if (ipv6) {
		const firstGroup = Number.parseInt(ipv6.split(':')[0], 16);
		return {
			version: 'IPv6',
			isPrivate: (firstGroup & 0xfe00) === 0xfc00,
			isLoopback: ipv6 === '::1',
			isLinkLocal: (firstGroup & 0xffc0) === 0xfe80,
			isMulticast: (firstGroup & 0xff00) === 0xff00
		};
	}

	return null;
}

/**
 * ドメインのDNSレコードとIP地理情報を取得
 */
export async function fetchDomainInfo(domain: string): Promise<{
	dnsRecords: DNSRecord[];
	ipGeoInfo?: IPGeoInfo;
	resolvedIP?: string;
}> {
	const dnsRecords: DNSRecord[] = [];

	const recordTypes = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME'];
	const results = await Promise.allSettled(
		recordTypes.map((type) => queryDNSOverHTTPS(domain, type))
	);
	for (const result of results) {
		if (result.status === 'fulfilled') dnsRecords.push(...result.value);
	}
	if (dnsRecords.length === 0 && results.some((result) => result.status === 'rejected')) {
		throw new Error('DNS情報を取得できませんでした');
	}

	let resolvedIP = (
		dnsRecords.find((r) => r.type === 'A') ?? dnsRecords.find((r) => r.type === 'AAAA')
	)?.data;
	let ipGeoInfo: IPGeoInfo | undefined;

	let cname = dnsRecords.find((r) => r.type === 'CNAME');
	for (let i = 0; i < 3 && !resolvedIP && cname; i++) {
		const target = cname.data.replace(/\.$/, '');
		const results = await Promise.allSettled(
			['A', 'AAAA'].map((type) => queryDNSOverHTTPS(target, type))
		);
		const answers = results.flatMap((result) =>
			result.status === 'fulfilled' ? result.value : []
		);
		const addresses = answers.filter((record) => record.type === 'A' || record.type === 'AAAA');
		resolvedIP = addresses[0]?.data;
		dnsRecords.push(
			...addresses.map((record) => ({ ...record, name: `${record.name} (via CNAME)` }))
		);
		cname = answers.find((record) => record.type === 'CNAME');
	}

	if (resolvedIP) {
		ipGeoInfo = (await fetchIPGeolocation(resolvedIP)) || undefined;
	}

	return { dnsRecords, ipGeoInfo, resolvedIP };
}

/**
 * DNSレコードをタイプ別にグループ化
 */
export function groupRecordsByType(records: DNSRecord[]): { [key: string]: DNSRecord[] } {
	return records.reduce(
		(acc, record) => {
			if (!acc[record.type]) acc[record.type] = [];
			acc[record.type].push(record);
			return acc;
		},
		{} as { [key: string]: DNSRecord[] }
	);
}

/**
 * DNSレコードをテキスト形式でフォーマット
 */
export function formatDnsRecordsAsText(records: DNSRecord[]): string {
	let text = '';
	const groupedRecords = groupRecordsByType(records);

	Object.entries(groupedRecords).forEach(([type, recs]) => {
		text += `${type}レコード:\n`;
		recs.forEach((record) => {
			text += `  ${record.data}${record.ttl ? ` (TTL: ${record.ttl}s)` : ''}\n`;
		});
		text += '\n';
	});

	return text;
}

/**
 * 地理情報をテキスト形式でフォーマット
 */
export function formatGeoInfoAsText(geoInfo: IPGeoInfo): string {
	let text = '';
	text += `IPアドレス: ${geoInfo.ip}\n`;
	text += `国/地域: ${geoInfo.country} (${geoInfo.countryCode})\n`;
	text += `州/県: ${geoInfo.region}\n`;
	text += `都市: ${geoInfo.city}\n`;
	text += `組織: ${geoInfo.org}\n`;
	text += `タイムゾーン: ${geoInfo.timezone}\n`;
	if (geoInfo.latitude !== null && geoInfo.longitude !== null) {
		text += `緯度経度: ${geoInfo.latitude}, ${geoInfo.longitude}\n`;
	}
	return text;
}

/**
 * ネットワーク情報をテキスト形式でフォーマット
 */
export function formatNetworkInfoAsText(geoInfo: IPGeoInfo): string {
	let text = '';
	if (geoInfo.as) text += `ASN: ${geoInfo.as}\n`;
	if (geoInfo.asname) text += `AS組織名: ${geoInfo.asname}\n`;
	if (geoInfo.isp) text += `ISP: ${geoInfo.isp}\n`;
	if (geoInfo.reverse) text += `逆引きホスト名: ${geoInfo.reverse}\n`;
	return text;
}

/**
 * セキュリティ情報をテキスト形式でフォーマット
 */
export function formatSecurityInfoAsText(geoInfo: IPGeoInfo): string {
	let text = '';
	if (geoInfo.proxy !== undefined) text += `プロキシ/VPN: ${geoInfo.proxy ? '検出' : '未検出'}\n`;
	if (geoInfo.mobile !== undefined) text += `モバイル回線: ${geoInfo.mobile ? 'はい' : 'いいえ'}\n`;
	if (geoInfo.hosting !== undefined)
		text += `ホスティング/DC: ${geoInfo.hosting ? 'はい' : 'いいえ'}\n`;
	return text;
}

/**
 * IP解析結果をテキスト形式でフォーマット
 */
export function formatIPAnalysisAsText(analysis: IPAnalysis): string {
	let text = '';
	text += `IPバージョン: ${analysis.version}\n`;
	if (analysis.isPrivate) text += `タイプ: プライベートアドレス\n`;
	else if (analysis.isLoopback) text += `タイプ: ループバックアドレス\n`;
	else if (analysis.isLinkLocal) text += `タイプ: リンクローカルアドレス\n`;
	else if (analysis.isMulticast) text += `タイプ: マルチキャストアドレス\n`;
	else text += `タイプ: パブリックアドレス\n`;
	if (analysis.ipClass) text += `クラス: Class ${analysis.ipClass}\n`;
	if (analysis.binary) text += `バイナリ: ${analysis.binary}\n`;
	if (analysis.hex) text += `16進数: ${analysis.hex}\n`;
	return text;
}

/**
 * 検索を実行してDomainInfoを返す
 */
export async function performSearch(query: string): Promise<DomainInfo> {
	const cleanQuery = query.trim().toLowerCase();

	if (!isIPAddress(cleanQuery) && !isDomainName(cleanQuery)) {
		throw new Error('有効なドメイン名またはIPアドレスを入力してください');
	}

	const isIP = isIPAddress(cleanQuery);

	if (isIP) {
		const geoInfo = await fetchIPGeolocation(cleanQuery);
		const ipAnalysisResult = analyzeIP(cleanQuery);
		return {
			domain: cleanQuery,
			isIP: true,
			isSubdomain: false,
			dnsRecords: [],
			ipGeoInfo: geoInfo || undefined,
			ipAnalysis: ipAnalysisResult || undefined
		};
	} else {
		const isSub = isSubdomain(cleanQuery);
		const rootDomain = extractRootDomain(cleanQuery);

		const { dnsRecords, ipGeoInfo } = await fetchDomainInfo(cleanQuery);

		let rootDnsRecords: DNSRecord[] | undefined;
		let rootIpGeoInfo: IPGeoInfo | undefined;

		if (isSub) {
			const rootInfo = await fetchDomainInfo(rootDomain);
			rootDnsRecords = rootInfo.dnsRecords;

			const subdomainIP = ipGeoInfo?.ip;
			const rootIP = rootInfo.ipGeoInfo?.ip;
			if (rootIP && rootIP !== subdomainIP) {
				rootIpGeoInfo = rootInfo.ipGeoInfo;
			}
		}

		return {
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
}
