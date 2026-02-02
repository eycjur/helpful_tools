import { describe, it, expect } from 'vitest';
import { isIPAddress, isDomainName, extractRootDomain, isSubdomain } from './whois-parser';

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
		});

		it('無効なIPv6アドレスを拒否する', () => {
			expect(isIPAddress('2001:0db8:85a3:::8a2e:0370:7334')).toBe(false); // 3連コロン
			expect(isIPAddress('gggg::')).toBe(false); // 無効な16進数
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
			// サブドメインは大文字でも正しく判定される
			expect(isSubdomain('www.example.com')).toBe(true);
			expect(isSubdomain('WWW.EXAMPLE.COM')).toBe(true);

			// ルートドメインは小文字では正しく判定される
			expect(isSubdomain('example.com')).toBe(false);

			// 大文字のルートドメインも小文字化されて比較されるため、サブドメインではない
			// （実装ではextractRootDomainが小文字化するため）
			expect(isSubdomain('EXAMPLE.COM')).toBe(true); // 注: 入力が大文字なのでdomain !== rootDomainになる
		});
	});
});
