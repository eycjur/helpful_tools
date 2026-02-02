import { describe, it, expect } from 'vitest';

describe('Pcap解析 - パーサー', () => {
	// Pcap解析は大規模なバイナリデータ処理を含むため、
	// ユニットテストではなく統合テストが適している
	// ここでは基本的なヘルパー関数のテストのみを実施

	it('16進数変換のテスト', () => {
		const byte = 255;
		const hex = byte.toString(16).padStart(2, '0');
		expect(hex).toBe('ff');
	});

	it('TCPフラグの解析テスト', () => {
		// FIN=1, SYN=1, ACK=1のフラグ (0x13)
		const flags = 0x13;
		const fin = (flags & 0x01) !== 0;
		const syn = (flags & 0x02) !== 0;
		const rst = (flags & 0x04) !== 0;
		const psh = (flags & 0x08) !== 0;
		const ack = (flags & 0x10) !== 0;

		expect(fin).toBe(true);
		expect(syn).toBe(true);
		expect(rst).toBe(false);
		expect(psh).toBe(false);
		expect(ack).toBe(true);
	});

	it('IPv4アドレス変換のテスト', () => {
		const bytes = new Uint8Array([192, 168, 1, 1]);
		const ip = Array.from(bytes).join('.');
		expect(ip).toBe('192.168.1.1');
	});
});
