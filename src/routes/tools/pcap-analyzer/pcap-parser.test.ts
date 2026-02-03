import { describe, it, expect } from 'vitest';
import { parsePcapFile, getLinkTypeName } from './pcap-parser';

function buildPcapBuffer({
	packetData,
	snapLen = 65535,
	magicNumber = 0xa1b2c3d4
}: {
	packetData: Uint8Array;
	snapLen?: number;
	magicNumber?: number;
}): ArrayBuffer {
	const globalHeaderSize = 24;
	const packetHeaderSize = 16;
	const totalSize = globalHeaderSize + packetHeaderSize + packetData.length;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// Global header (little endian)
	view.setUint32(0, magicNumber, true);
	view.setUint16(4, 2, true);
	view.setUint16(6, 4, true);
	view.setInt32(8, 0, true);
	view.setUint32(12, 0, true);
	view.setUint32(16, snapLen, true);
	view.setUint32(20, 1, true); // Ethernet

	// Packet header
	const packetOffset = globalHeaderSize;
	view.setUint32(packetOffset + 0, 1, true); // ts sec
	view.setUint32(packetOffset + 4, 500000, true); // ts usec
	view.setUint32(packetOffset + 8, packetData.length, true);
	view.setUint32(packetOffset + 12, packetData.length, true);

	// Packet data
	const bytes = new Uint8Array(buffer, globalHeaderSize + packetHeaderSize);
	bytes.set(packetData);

	return buffer;
}

function buildUdpDnsPacket(): Uint8Array {
	const dnsQuery = new Uint8Array([
		0x1a,
		0x2b, // ID
		0x01,
		0x00, // flags
		0x00,
		0x01, // QDCOUNT
		0x00,
		0x00, // ANCOUNT
		0x00,
		0x00, // NSCOUNT
		0x00,
		0x00, // ARCOUNT
		0x07,
		...Array.from('example').map((c) => c.charCodeAt(0)),
		0x03,
		...Array.from('com').map((c) => c.charCodeAt(0)),
		0x00,
		0x00,
		0x01, // QTYPE=A
		0x00,
		0x01 // QCLASS=IN
	]);

	const udpLength = 8 + dnsQuery.length;
	const ipTotalLength = 20 + udpLength;
	const packet = new Uint8Array(14 + ipTotalLength);

	// Ethernet header
	packet.set([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01], 0); // dest
	packet.set([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x02], 6); // src
	packet[12] = 0x08;
	packet[13] = 0x00; // IPv4

	// IPv4 header
	const ipOffset = 14;
	packet[ipOffset] = 0x45; // version=4, ihl=5
	packet[ipOffset + 1] = 0x00;
	packet[ipOffset + 2] = (ipTotalLength >> 8) & 0xff;
	packet[ipOffset + 3] = ipTotalLength & 0xff;
	packet[ipOffset + 4] = 0x00;
	packet[ipOffset + 5] = 0x01;
	packet[ipOffset + 6] = 0x00;
	packet[ipOffset + 7] = 0x00;
	packet[ipOffset + 8] = 64; // TTL
	packet[ipOffset + 9] = 17; // UDP
	packet[ipOffset + 10] = 0x00;
	packet[ipOffset + 11] = 0x00; // checksum
	packet.set([192, 168, 0, 10], ipOffset + 12); // src IP
	packet.set([8, 8, 8, 8], ipOffset + 16); // dst IP

	// UDP header
	const udpOffset = ipOffset + 20;
	packet[udpOffset] = 0x30;
	packet[udpOffset + 1] = 0x39; // src port 12345
	packet[udpOffset + 2] = 0x00;
	packet[udpOffset + 3] = 0x35; // dst port 53
	packet[udpOffset + 4] = (udpLength >> 8) & 0xff;
	packet[udpOffset + 5] = udpLength & 0xff;
	packet[udpOffset + 6] = 0x00;
	packet[udpOffset + 7] = 0x00; // checksum

	packet.set(dnsQuery, udpOffset + 8);
	return packet;
}

describe('Pcap解析 - パーサー', () => {
	it('pcapを解析してUDP/DNSを抽出できる', async () => {
		const packetData = buildUdpDnsPacket();
		const buffer = buildPcapBuffer({ packetData });
		const result = await parsePcapFile(buffer);

		expect(result.packets.length).toBe(1);
		expect(result.statistics.totalPackets).toBe(1);
		expect(result.statistics.totalBytes).toBe(packetData.length);
		expect(result.statistics.protocolDistribution.UDP).toBe(1);

		const packet = result.packets[0]!;
		expect(packet.protocol).toBe('UDP');
		expect(packet.ipv4?.sourceIp).toBe('192.168.0.10');
		expect(packet.ipv4?.destinationIp).toBe('8.8.8.8');
		expect(packet.udp?.destinationPort).toBe(53);
		expect(packet.dns?.queryName).toBe('example.com.');
		expect(packet.dns?.queryType).toBe(1);
	});

	it('キャプチャ長がsnapLenを超える場合はパケットを破棄する', async () => {
		const packetData = buildUdpDnsPacket();
		const buffer = buildPcapBuffer({ packetData, snapLen: 10 });
		const result = await parsePcapFile(buffer);

		expect(result.packets.length).toBe(0);
		expect(result.statistics.totalPackets).toBe(0);
	});

	it('無効なマジックナンバーはエラーになる', async () => {
		const packetData = buildUdpDnsPacket();
		const buffer = buildPcapBuffer({ packetData, magicNumber: 0xdeadbeef });
		await expect(parsePcapFile(buffer)).rejects.toThrow('無効なpcapファイル');
	});

	it('リンク層タイプ名を取得できる', () => {
		expect(getLinkTypeName(1)).toBe('Ethernet');
		expect(getLinkTypeName(229)).toBe('IPv6');
		expect(getLinkTypeName(999)).toBe('Unknown (999)');
	});
});
