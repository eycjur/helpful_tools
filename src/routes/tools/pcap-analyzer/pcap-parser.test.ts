import { describe, it, expect } from 'vitest';
import { parsePcapFile, getLinkTypeName } from './pcap-parser';

function buildPcapBuffer({
	packetData,
	snapLen = 65535,
	magicNumber = 0xa1b2c3d4,
	littleEndian = true,
	timestampFraction = 500_000
}: {
	packetData: Uint8Array;
	snapLen?: number;
	magicNumber?: number;
	littleEndian?: boolean;
	timestampFraction?: number;
}): ArrayBuffer {
	const globalHeaderSize = 24;
	const packetHeaderSize = 16;
	const totalSize = globalHeaderSize + packetHeaderSize + packetData.length;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	// Global header
	view.setUint32(0, magicNumber, littleEndian);
	view.setUint16(4, 2, littleEndian);
	view.setUint16(6, 4, littleEndian);
	view.setUint32(16, snapLen, littleEndian);
	view.setUint32(20, 1, littleEndian); // Ethernet

	// Packet header
	const packetOffset = globalHeaderSize;
	view.setUint32(packetOffset, 1, littleEndian); // ts sec
	view.setUint32(packetOffset + 4, timestampFraction, littleEndian);
	view.setUint32(packetOffset + 8, packetData.length, littleEndian);
	view.setUint32(packetOffset + 12, packetData.length, littleEndian);

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

function buildPcapngSection(littleEndian: boolean, linkType: number, resolution: number) {
	const packet = buildUdpDnsPacket();
	const paddedLength = Math.ceil(packet.length / 4) * 4;
	const sectionLength = 28;
	const interfaceLength = 44;
	const enhancedPacketLength = 32 + paddedLength;
	const simplePacketLength = 16 + paddedLength;
	const bytes = new Uint8Array(
		sectionLength + interfaceLength + enhancedPacketLength + simplePacketLength
	);
	const view = new DataView(bytes.buffer);
	let offset = 0;
	const block = (type: number, length: number) => {
		view.setUint32(offset, type, littleEndian);
		view.setUint32(offset + 4, length, littleEndian);
		view.setUint32(offset + length - 4, length, littleEndian);
		const bodyOffset = offset + 8;
		offset += length;
		return bodyOffset;
	};

	const section = block(0x0a0d0d0a, sectionLength);
	view.setUint32(section, 0x1a2b3c4d, littleEndian);
	view.setUint16(section + 4, 1, littleEndian);
	view.setBigInt64(section + 8, -1n, littleEndian);

	const network = block(1, interfaceLength);
	view.setUint16(network, linkType, littleEndian);
	view.setUint32(network + 4, 65535, littleEndian);
	view.setUint16(network + 8, 9, littleEndian); // if_tsresol
	view.setUint16(network + 10, 1, littleEndian);
	view.setUint8(network + 12, resolution);
	view.setUint16(network + 16, 14, littleEndian); // if_tsoffset
	view.setUint16(network + 18, 8, littleEndian);
	view.setBigInt64(network + 20, -1n, littleEndian);

	const enhanced = block(6, enhancedPacketLength);
	view.setUint32(enhanced + 4, 1, littleEndian);
	view.setUint32(enhanced + 8, 204, littleEndian);
	view.setUint32(enhanced + 12, packet.length, littleEndian);
	view.setUint32(enhanced + 16, packet.length, littleEndian);
	bytes.set(packet, enhanced + 20);

	const simple = block(3, simplePacketLength);
	view.setUint32(simple, packet.length, littleEndian);
	bytes.set(packet, simple + 4);
	return bytes;
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

	it('リンク情報にFCS長が含まれるEthernetのpcapも解析する', async () => {
		const buffer = buildPcapBuffer({ packetData: buildUdpDnsPacket() });
		new DataView(buffer).setUint32(20, 0x24000001, true);
		const result = await parsePcapFile(buffer);
		expect(result.globalHeader.network).toBe(1);
		expect(result.packets[0]?.protocol).toBe('UDP');
	});

	it('LSOv2で全長0のTCPパケットをキャプチャ済みの範囲で解析する', async () => {
		const ipOffset = 14;
		const tcpOffset = ipOffset + 20;
		const payload = new Uint8Array(2048).fill(0x61);
		const packetData = new Uint8Array(tcpOffset + 20 + payload.length);
		packetData.set(buildUdpDnsPacket().subarray(0, tcpOffset));
		const view = new DataView(packetData.buffer);
		view.setUint16(ipOffset + 2, 0);
		view.setUint8(ipOffset + 9, 6);
		view.setUint16(tcpOffset, 12345);
		view.setUint16(tcpOffset + 2, 443);
		view.setUint8(tcpOffset + 12, 0x50);
		packetData.set(payload, tcpOffset + 20);

		const result = await parsePcapFile(buildPcapBuffer({ packetData }));
		expect(result.packets[0]?.ipv4?.totalLength).toBe(0);
		expect(result.packets[0]?.tcp?.destinationPort).toBe(443);
		expect(result.packets[0]?.payload).toEqual(payload);
		expect(result.statistics.protocolDistribution.TCP).toBe(1);
	});

	it.each([
		[17, 0],
		[6, 19]
	])('IPv4の短すぎる全長を拒否する（protocol=%s, length=%s）', async (protocol, length) => {
		const packetData = buildUdpDnsPacket();
		const view = new DataView(packetData.buffer);
		view.setUint16(14 + 2, length);
		view.setUint8(14 + 9, protocol);
		const result = await parsePcapFile(buildPcapBuffer({ packetData }));
		expect(result.packets[0]?.ipv4).toBeUndefined();
		expect(result.statistics.protocolDistribution.Other).toBe(1);
	});

	it.each([true, false])(
		'ナノ秒pcapの時刻を秒に換算する（littleEndian=%s）',
		async (littleEndian) => {
			const buffer = buildPcapBuffer({
				packetData: buildUdpDnsPacket(),
				magicNumber: 0xa1b23c4d,
				littleEndian,
				timestampFraction: 500_000_000
			});
			const result = await parsePcapFile(buffer);
			expect(result.format).toBe('pcap');
			expect(result.globalHeader.isLittleEndian).toBe(littleEndian);
			expect(result.packets[0]?.timestamp).toBe(1.5);
		}
	);

	it('バイト順の異なるpcapngセクションごとに時刻単位とリンク層を適用する', async () => {
		const littleEndianSection = buildPcapngSection(true, 1, 9);
		const bigEndianSection = buildPcapngSection(false, 113, 0x80 | 31);
		const combined = new Uint8Array(littleEndianSection.length + bigEndianSection.length);
		combined.set(littleEndianSection);
		combined.set(bigEndianSection, littleEndianSection.length);

		const result = await parsePcapFile(combined.buffer);
		expect(result.format).toBe('pcapng');
		expect(result.globalHeader.network).toBeNull();
		expect(result.packets.map((packet) => packet.protocol)).toEqual([
			'UDP',
			'UDP',
			'Other',
			'Other'
		]);
		expect(result.packets[0]?.dns?.queryName).toBe('example.com.');
		expect(result.packets[0]?.timestamp).toBeCloseTo(3.2949675);
		expect(result.packets[1]?.timestamp).toBeNull();
		expect(result.packets[2]?.timestamp).toBeCloseTo(1.000000095);
		expect(result.packets[3]?.timestamp).toBeNull();
		expect(result.statistics.captureStartTime).toBe(result.packets[2]?.timestamp);
		expect(result.statistics.captureEndTime).toBe(result.packets[0]?.timestamp);
	});

	it('途中で切れたpcapngと不一致のブロック長を拒否する', async () => {
		const bytes = buildPcapngSection(true, 1, 6);
		await expect(parsePcapFile(bytes.buffer.slice(0, -1))).rejects.toThrow('ブロックの長さが不正');
		new DataView(bytes.buffer).setUint32(bytes.length - 4, 12, true);
		await expect(parsePcapFile(bytes.buffer)).rejects.toThrow('ブロックの長さが不正');
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
