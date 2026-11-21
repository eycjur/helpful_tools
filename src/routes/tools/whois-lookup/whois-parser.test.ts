import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	isIPAddress,
	isDomainName,
	extractRootDomain,
	isSubdomain,
	analyzeIP,
	groupRecordsByType,
	formatDnsRecordsAsText,
	formatGeoInfoAsText,
	formatNetworkInfoAsText,
	formatSecurityInfoAsText,
	formatIPAnalysisAsText,
	performSearch
} from './whois-parser';

describe('Whois解析 - パーサー', () => {
	describe('isIPAddress', () => {
		it('有効なIPv4アドレスを検出できる', () => {
			expect(isIPAddress('192.168.1.1')).toBe(true);
			expect(isIPAddress('8.8.8.8')).toBe(true);
			expect(isIPAddress('255.255.255.255')).toBe(true);
			expect(isIPAddress('0.0.0.0')).toBe(true);
		});

		it('無効なIPv4アドレスを検出できる', () => {
			expect(isIPAddress('256.1.1.1')).toBe(false); // 256は範囲外
			expect(isIPAddress('192.168.1')).toBe(false); // 3オクテットのみ
			expect(isIPAddress('192.168.1.1.1')).toBe(false); // 5オクテット
			expect(isIPAddress('abc.def.ghi.jkl')).toBe(false); // 英字
		});

		it('有効なIPv6アドレスを検出できる', () => {
			expect(isIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
			expect(isIPAddress('2001:db8:85a3::8a2e:370:7334')).toBe(true); // 圧縮表記
			expect(isIPAddress('::1')).toBe(true); // ループバック
			expect(isIPAddress('::')).toBe(true); // 全ゼロ
			expect(isIPAddress('::ffff:192.0.2.1')).toBe(true);
		});

		it('無効なIPv6アドレスを拒否する', () => {
			expect(isIPAddress('2001:0db8:85a3:::8a2e:0370:7334')).toBe(false); // 3連コロン
			expect(isIPAddress('gggg::')).toBe(false); // 無効な16進数
			expect(isIPAddress('::ffff:256.0.2.1')).toBe(false);
		});

		it('ドメイン名をIPアドレスとして検出しない', () => {
			expect(isIPAddress('example.com')).toBe(false);
			expect(isIPAddress('192.168.1.1.example.com')).toBe(false);
		});
	});

	describe('isDomainName', () => {
		it('有効なドメイン名を検出できる', () => {
			expect(isDomainName('example.com')).toBe(true);
			expect(isDomainName('sub.example.com')).toBe(true);
			expect(isDomainName('my-site.co.jp')).toBe(true);
			expect(isDomainName('test123.example.org')).toBe(true);
		});

		it('無効なドメイン名を拒否する', () => {
			expect(isDomainName('example')).toBe(false); // TLDなし
			expect(isDomainName('-example.com')).toBe(false); // ハイフン開始
			expect(isDomainName('example-.com')).toBe(false); // ハイフン終了
			expect(isDomainName('example..com')).toBe(false); // 連続ドット
			expect(isDomainName('.example.com')).toBe(false); // ドット開始
			expect(isDomainName('example.com.')).toBe(false); // ドット終了
		});

		it('長すぎるドメイン名を拒否する', () => {
			const longDomain = 'a'.repeat(254) + '.com';
			expect(isDomainName(longDomain)).toBe(false); // 253文字超過
		});

		it('ラベルが長すぎる場合を拒否する', () => {
			const longLabel = 'a'.repeat(64) + '.com';
			expect(isDomainName(longLabel)).toBe(false); // 63文字超過
		});
	});

	describe('extractRootDomain', () => {
		it('通常のTLDからルートドメインを抽出できる', () => {
			expect(extractRootDomain('example.com')).toBe('example.com');
			expect(extractRootDomain('www.example.com')).toBe('example.com');
			expect(extractRootDomain('sub.domain.example.com')).toBe('example.com');
		});

		it('2レベルTLD（co.jp等）からルートドメインを抽出できる', () => {
			expect(extractRootDomain('example.co.jp')).toBe('example.co.jp');
			expect(extractRootDomain('www.example.co.jp')).toBe('example.co.jp');
			expect(extractRootDomain('sub.example.co.jp')).toBe('example.co.jp');
		});

		it('イギリスドメインからルートドメインを抽出できる', () => {
			expect(extractRootDomain('example.co.uk')).toBe('example.co.uk');
			expect(extractRootDomain('www.example.co.uk')).toBe('example.co.uk');
		});

		it('短いドメインをそのまま返す', () => {
			expect(extractRootDomain('example.com')).toBe('example.com');
			expect(extractRootDomain('co.jp')).toBe('co.jp');
		});
	});

	describe('isSubdomain', () => {
		it('サブドメインを正しく判定できる', () => {
			expect(isSubdomain('www.example.com')).toBe(true);
			expect(isSubdomain('api.example.com')).toBe(true);
			expect(isSubdomain('sub.domain.example.com')).toBe(true);
		});

		it('ルートドメインをサブドメインと判定しない', () => {
			expect(isSubdomain('example.com')).toBe(false);
			expect(isSubdomain('example.co.jp')).toBe(false);
			expect(isSubdomain('example.org')).toBe(false);
		});

		it('大文字小文字を正しく処理する', () => {
			expect(isSubdomain('WWW.EXAMPLE.COM')).toBe(true);
			expect(isSubdomain('EXAMPLE.COM')).toBe(false);
		});
	});

	describe('analyzeIP', () => {
		it('IPv4の属性を解析できる', () => {
			const analysis = analyzeIP('192.168.1.10');
			expect(analysis?.version).toBe('IPv4');
			expect(analysis?.isPrivate).toBe(true);
			expect(analysis?.isLoopback).toBe(false);
			expect(analysis?.isLinkLocal).toBe(false);
			expect(analysis?.ipClass).toBe('C');
			expect(analysis?.binary).toBe('11000000.10101000.00000001.00001010');
		});

		it('ループバックやマルチキャストを判定できる', () => {
			expect(analyzeIP('127.0.0.1')?.isLoopback).toBe(true);
			expect(analyzeIP('224.0.0.1')?.isMulticast).toBe(true);
		});

		it('無効なIPv4はnullになる', () => {
			expect(analyzeIP('999.0.0.1')).toBeNull();
		});

		it('IPv6の属性を解析できる', () => {
			expect(analyzeIP('fc00::1')?.isPrivate).toBe(true);
			expect(analyzeIP('fe80::1')?.isLinkLocal).toBe(true);
			expect(analyzeIP('ff00::1')?.isMulticast).toBe(true);
		});

		it('IPv6リンクローカルの境界と展開されたループバックを判定する', () => {
			expect(analyzeIP('fe7f::1')?.isLinkLocal).toBe(false);
			expect(analyzeIP('fe80::1')?.isLinkLocal).toBe(true);
			expect(analyzeIP('febf::1')?.isLinkLocal).toBe(true);
			expect(analyzeIP('fec0::1')?.isLinkLocal).toBe(false);
			expect(analyzeIP('0:0:0:0:0:0:0:1')?.isLoopback).toBe(true);
			expect(analyzeIP('::::')).toBeNull();
		});
	});

	describe('DNSレコードの整形', () => {
		it('タイプ別にグルーピングできる', () => {
			const grouped = groupRecordsByType([
				{ name: 'example.com', type: 'A', data: '1.1.1.1' },
				{ name: 'example.com', type: 'A', data: '1.1.1.2' },
				{ name: 'example.com', type: 'MX', data: 'mail.example.com' }
			]);
			expect(grouped.A?.length).toBe(2);
			expect(grouped.MX?.length).toBe(1);
		});

		it('DNSレコードをテキスト化できる', () => {
			const text = formatDnsRecordsAsText([
				{ name: 'example.com', type: 'A', data: '1.1.1.1', ttl: 60 }
			]);
			expect(text).toContain('Aレコード');
			expect(text).toContain('1.1.1.1');
			expect(text).toContain('TTL: 60s');
		});
	});

	describe('フォーマット関数', () => {
		it('地理情報を整形できる', () => {
			const text = formatGeoInfoAsText({
				ip: '1.1.1.1',
				city: 'City',
				region: 'Region',
				country: 'Country',
				countryCode: 'CC',
				timezone: 'UTC',
				latitude: 1,
				longitude: 2,
				org: 'Org',
				postal: '000'
			});
			expect(text).toContain('IPアドレス: 1.1.1.1');
			expect(text).toContain('国/地域: Country');
		});

		it('ネットワーク情報を整形できる', () => {
			const text = formatNetworkInfoAsText({
				ip: '1.1.1.1',
				city: 'City',
				region: 'Region',
				country: 'Country',
				countryCode: 'CC',
				timezone: 'UTC',
				latitude: 1,
				longitude: 2,
				org: 'Org',
				postal: '000',
				as: 'AS13335',
				asname: 'CLOUDFLARENET',
				isp: 'Cloudflare',
				reverse: 'one.one.one.one'
			});
			expect(text).toContain('ASN: AS13335');
			expect(text).toContain('AS組織名: CLOUDFLARENET');
		});

		it('欠けた座標は表示せず、緯度経度0は値として表示する', () => {
			const geoInfo = {
				ip: '203.0.113.5',
				city: 'City',
				region: 'Region',
				country: 'Country',
				countryCode: 'CC',
				timezone: 'UTC',
				org: 'Org',
				postal: '000'
			};
			expect(formatGeoInfoAsText({ ...geoInfo, latitude: null, longitude: null })).not.toContain(
				'緯度経度'
			);
			expect(formatGeoInfoAsText({ ...geoInfo, latitude: 0, longitude: 0 })).toContain(
				'緯度経度: 0, 0'
			);
		});

		it('セキュリティ情報を整形できる', () => {
			const text = formatSecurityInfoAsText({
				ip: '1.1.1.1',
				city: 'City',
				region: 'Region',
				country: 'Country',
				countryCode: 'CC',
				timezone: 'UTC',
				latitude: 1,
				longitude: 2,
				org: 'Org',
				postal: '000',
				proxy: false,
				mobile: true,
				hosting: true
			});
			expect(text).toContain('プロキシ/VPN: 未検出');
			expect(text).toContain('モバイル回線: はい');
			expect(text).toContain('ホスティング/DC: はい');
		});

		it('IP解析結果を整形できる', () => {
			const text = formatIPAnalysisAsText({
				version: 'IPv4',
				isPrivate: false,
				isLoopback: false,
				isLinkLocal: false,
				isMulticast: false,
				ipClass: 'A',
				binary: '00000000.00000000.00000000.00000000',
				hex: '00000000'
			});
			expect(text).toContain('IPバージョン: IPv4');
			expect(text).toContain('クラス: Class A');
		});
	});

	describe('performSearch', () => {
		const originalFetch = globalThis.fetch;

		beforeEach(() => {
			globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('ipapi.co')) {
					return {
						ok: true,
						json: async () => ({
							ip: '8.8.8.8',
							city: 'Mountain View',
							region: 'California',
							country_name: 'United States',
							country_code: 'US',
							timezone: 'America/Los_Angeles',
							latitude: 37.4,
							longitude: -122.1,
							org: 'Google LLC',
							asn: 'AS15169',
							hostname: 'dns.google',
							postal: '94043'
						})
					} as Response;
				}

				if (url.includes('dns-query')) {
					const params = new URL(url).searchParams;
					const type = params.get('type');
					if (type === 'A') {
						return {
							ok: true,
							json: async () => ({
								Answer: [{ name: 'example.com.', type: 1, data: '93.184.216.34', TTL: 60 }]
							})
						} as Response;
					}
					return { ok: true, json: async () => ({}) } as Response;
				}

				return { ok: false, json: async () => ({}) } as Response;
			});
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('IP入力でIP情報を返す', async () => {
			const result = await performSearch('8.8.8.8');
			expect(result.isIP).toBe(true);
			expect(result.ipGeoInfo?.country).toBe('United States');
			expect(result.ipGeoInfo).toMatchObject({
				as: 'AS15169',
				asname: 'Google LLC',
				reverse: 'dns.google'
			});
		});

		it('ドメイン入力でDNS情報を返す', async () => {
			const result = await performSearch('example.com');
			expect(result.isIP).toBe(false);
			expect(result.dnsRecords.length).toBeGreaterThan(0);
			expect(result.dnsRecords[0]?.type).toBe('A');
		});

		it('AAAAのみのドメインもIPv6アドレスから地理情報を取得する', async () => {
			const address = '2001:db8::1';
			const fetchMock = vi.mocked(globalThis.fetch);
			const defaultFetch = fetchMock.getMockImplementation()!;
			fetchMock.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (!url.pathname.endsWith('/dns-query')) return defaultFetch(input);
				const answers =
					url.searchParams.get('type') === 'AAAA'
						? [{ name: 'example.com.', type: 28, data: address, TTL: 60 }]
						: [];
				return Response.json({ Status: 0, Answer: answers });
			});
			const result = await performSearch('example.com');
			expect(result.dnsRecords[0]?.type).toBe('AAAA');
			expect(result.ipGeoInfo).toBeDefined();
			expect(fetchMock).toHaveBeenCalledWith('https://ipapi.co/2001%3Adb8%3A%3A1/json/');
		});

		it('CNAME解決中はCNAMEの値をIPアドレスとして扱わない', async () => {
			const fetchMock = vi.mocked(globalThis.fetch);
			const defaultFetch = fetchMock.getMockImplementation()!;
			fetchMock.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (!url.pathname.endsWith('/dns-query')) return defaultFetch(input);
				const name = url.searchParams.get('name');
				const type = url.searchParams.get('type');
				const targets = new Map([
					['example.com', 'one.example.net.'],
					['one.example.net', 'two.example.net.']
				]);
				const target = targets.get(name ?? '');
				const answers = target
					? [{ name, type: 5, data: target, TTL: 60 }]
					: type === 'AAAA'
						? [{ name, type: 28, data: '2001:db8::1', TTL: 60 }]
						: [];
				return Response.json({ Status: 0, Answer: answers });
			});
			const result = await performSearch('example.com');
			expect(result.dnsRecords).toContainEqual(
				expect.objectContaining({ type: 'AAAA', data: '2001:db8::1' })
			);
			expect(fetchMock).toHaveBeenCalledWith('https://ipapi.co/2001%3Adb8%3A%3A1/json/');
			expect(fetchMock).not.toHaveBeenCalledWith('https://ipapi.co/two.example.net./json/');
		});

		it('NXDOMAINとDNSサーバー障害を区別する', async () => {
			const fetchMock = vi.mocked(globalThis.fetch);
			fetchMock.mockImplementation(async () => Response.json({ Status: 3 }));
			await expect(performSearch('example.com')).resolves.toMatchObject({ dnsRecords: [] });
			fetchMock.mockImplementation(async () => Response.json({ Status: 2 }));
			await expect(performSearch('example.com')).rejects.toThrow('DNS情報を取得できませんでした');
		});

		it('一部のDNS照会が失敗した場合は、取得できたレコードを返し、空ならエラーにする', async () => {
			const fetchMock = vi.mocked(globalThis.fetch);
			const defaultFetch = fetchMock.getMockImplementation()!;
			let hasRecord = false;
			fetchMock.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (!url.pathname.endsWith('/dns-query')) return defaultFetch(input);
				const type = url.searchParams.get('type');
				if (type === 'MX') return Response.json({ Status: 2 });
				if (type === 'A' && hasRecord) return defaultFetch(input);
				return Response.json({ Status: 0 });
			});
			await expect(performSearch('example.com')).rejects.toThrow('DNS情報を取得できませんでした');
			hasRecord = true;
			await expect(performSearch('example.com')).resolves.toMatchObject({
				dnsRecords: [{ type: 'A', data: '93.184.216.34' }]
			});
		});
	});
});
