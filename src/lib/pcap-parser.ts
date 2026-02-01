/**
 * Pcap/Pcapng ファイルパーサー
 * pcapファイルのバイナリ解析と統計情報抽出
 */

export type PcapGlobalHeader = {
	magicNumber: number;
	versionMajor: number;
	versionMinor: number;
	thisZone: number;
	sigFigs: number;
	snapLen: number;
	network: number;
	isLittleEndian: boolean;
};

export type PacketHeader = {
	timestampSeconds: number;
	timestampMicroseconds: number;
	capturedLength: number;
	originalLength: number;
};

export type EthernetFrame = {
	destinationMac: string;
	sourceMac: string;
	etherType: number;
};

export type IPv4Header = {
	version: number;
	ihl: number;
	tos: number;
	totalLength: number;
	identification: number;
	flags: number;
	fragmentOffset: number;
	ttl: number;
	protocol: number;
	headerChecksum: number;
	sourceIp: string;
	destinationIp: string;
};

export type TCPHeader = {
	sourcePort: number;
	destinationPort: number;
	sequenceNumber: number;
	acknowledgmentNumber: number;
	dataOffset: number;
	flags: number;
	windowSize: number;
	checksum: number;
	urgentPointer: number;
};

export type UDPHeader = {
	sourcePort: number;
	destinationPort: number;
	length: number;
	checksum: number;
};

export type ParsedPacket = {
	index: number;
	timestamp: number;
	capturedLength: number;
	originalLength: number;
	ethernet?: EthernetFrame;
	ipv4?: IPv4Header;
	tcp?: TCPHeader;
	udp?: UDPHeader;
	protocol: 'TCP' | 'UDP' | 'ICMP' | 'ARP' | 'IPv6' | 'Other';
	payload?: Uint8Array;
};

export type PcapStatistics = {
	totalPackets: number;
	totalBytes: number;
	captureStartTime: number;
	captureEndTime: number;
	averagePacketSize: number;
	protocolDistribution: Record<string, number>;
	sourceIps: Record<string, number>;
	destinationIps: Record<string, number>;
	sourcePorts: Record<number, number>;
	destinationPorts: Record<number, number>;
};

export type PcapAnalysisResult = {
	globalHeader: PcapGlobalHeader;
	packets: ParsedPacket[];
	statistics: PcapStatistics;
};

/**
 * MACアドレスをバイト配列から文字列に変換
 */
function macToString(bytes: Uint8Array, offset: number): string {
	return Array.from(bytes.slice(offset, offset + 6))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join(':');
}

/**
 * IPアドレスをバイト配列から文字列に変換
 */
function ipToString(bytes: Uint8Array, offset: number): string {
	return Array.from(bytes.slice(offset, offset + 4)).join('.');
}

/**
 * Pcapグローバルヘッダーを解析
 */
function parseGlobalHeader(buffer: ArrayBuffer): PcapGlobalHeader {
	const view = new DataView(buffer, 0, 24);
	const magicNumber = view.getUint32(0, true); // リトルエンディアンで読んでみる

	// マジックナンバーでエンディアンを判定
	const isLittleEndian = magicNumber === 0xa1b2c3d4 || magicNumber === 0xa1b23c4d;

	return {
		magicNumber,
		versionMajor: view.getUint16(4, isLittleEndian),
		versionMinor: view.getUint16(6, isLittleEndian),
		thisZone: view.getInt32(8, isLittleEndian),
		sigFigs: view.getUint32(12, isLittleEndian),
		snapLen: view.getUint32(16, isLittleEndian),
		network: view.getUint32(20, isLittleEndian),
		isLittleEndian
	};
}

/**
 * パケットヘッダーを解析
 */
function parsePacketHeader(
	buffer: ArrayBuffer,
	offset: number,
	isLittleEndian: boolean
): PacketHeader {
	const view = new DataView(buffer, offset, 16);
	return {
		timestampSeconds: view.getUint32(0, isLittleEndian),
		timestampMicroseconds: view.getUint32(4, isLittleEndian),
		capturedLength: view.getUint32(8, isLittleEndian),
		originalLength: view.getUint32(12, isLittleEndian)
	};
}

/**
 * Ethernetフレームを解析
 */
function parseEthernetFrame(packetData: Uint8Array): EthernetFrame | null {
	if (packetData.length < 14) return null;

	return {
		destinationMac: macToString(packetData, 0),
		sourceMac: macToString(packetData, 6),
		etherType: (packetData[12]! << 8) | packetData[13]!
	};
}

/**
 * IPv4ヘッダーを解析
 */
function parseIPv4Header(packetData: Uint8Array, offset: number): IPv4Header | null {
	if (packetData.length < offset + 20) return null;

	const versionIhl = packetData[offset]!;
	const version = (versionIhl >> 4) & 0x0f;
	const ihl = versionIhl & 0x0f;

	if (version !== 4) return null;

	return {
		version,
		ihl,
		tos: packetData[offset + 1]!,
		totalLength: (packetData[offset + 2]! << 8) | packetData[offset + 3]!,
		identification: (packetData[offset + 4]! << 8) | packetData[offset + 5]!,
		flags: (packetData[offset + 6]! >> 5) & 0x07,
		fragmentOffset: ((packetData[offset + 6]! & 0x1f) << 8) | packetData[offset + 7]!,
		ttl: packetData[offset + 8]!,
		protocol: packetData[offset + 9]!,
		headerChecksum: (packetData[offset + 10]! << 8) | packetData[offset + 11]!,
		sourceIp: ipToString(packetData, offset + 12),
		destinationIp: ipToString(packetData, offset + 16)
	};
}

/**
 * TCPヘッダーを解析
 */
function parseTCPHeader(packetData: Uint8Array, offset: number): TCPHeader | null {
	if (packetData.length < offset + 20) return null;

	return {
		sourcePort: (packetData[offset]! << 8) | packetData[offset + 1]!,
		destinationPort: (packetData[offset + 2]! << 8) | packetData[offset + 3]!,
		sequenceNumber:
			(packetData[offset + 4]! << 24) |
			(packetData[offset + 5]! << 16) |
			(packetData[offset + 6]! << 8) |
			packetData[offset + 7]!,
		acknowledgmentNumber:
			(packetData[offset + 8]! << 24) |
			(packetData[offset + 9]! << 16) |
			(packetData[offset + 10]! << 8) |
			packetData[offset + 11]!,
		dataOffset: (packetData[offset + 12]! >> 4) & 0x0f,
		flags: packetData[offset + 13]!,
		windowSize: (packetData[offset + 14]! << 8) | packetData[offset + 15]!,
		checksum: (packetData[offset + 16]! << 8) | packetData[offset + 17]!,
		urgentPointer: (packetData[offset + 18]! << 8) | packetData[offset + 19]!
	};
}

/**
 * UDPヘッダーを解析
 */
function parseUDPHeader(packetData: Uint8Array, offset: number): UDPHeader | null {
	if (packetData.length < offset + 8) return null;

	return {
		sourcePort: (packetData[offset]! << 8) | packetData[offset + 1]!,
		destinationPort: (packetData[offset + 2]! << 8) | packetData[offset + 3]!,
		length: (packetData[offset + 4]! << 8) | packetData[offset + 5]!,
		checksum: (packetData[offset + 6]! << 8) | packetData[offset + 7]!
	};
}

/**
 * パケットデータを解析
 */
function parsePacketData(
	packetData: Uint8Array,
	index: number,
	header: PacketHeader
): ParsedPacket {
	const packet: ParsedPacket = {
		index,
		timestamp: header.timestampSeconds + header.timestampMicroseconds / 1000000,
		capturedLength: header.capturedLength,
		originalLength: header.originalLength,
		protocol: 'Other'
	};

	// Ethernetフレームを解析
	const ethernet = parseEthernetFrame(packetData);
	if (!ethernet) return packet;

	packet.ethernet = ethernet;

	// EtherType判定
	const ipOffset = 14; // Ethernet header size

	// IPv4の場合
	if (ethernet.etherType === 0x0800) {
		const ipv4 = parseIPv4Header(packetData, ipOffset);
		if (!ipv4) return packet;

		packet.ipv4 = ipv4;
		const transportOffset = ipOffset + ipv4.ihl * 4;

		// プロトコル判定
		if (ipv4.protocol === 6) {
			// TCP
			packet.protocol = 'TCP';
			const tcp = parseTCPHeader(packetData, transportOffset);
			if (tcp) {
				packet.tcp = tcp;
				const payloadOffset = transportOffset + tcp.dataOffset * 4;
				if (payloadOffset < packetData.length) {
					packet.payload = packetData.slice(payloadOffset);
				}
			}
		} else if (ipv4.protocol === 17) {
			// UDP
			packet.protocol = 'UDP';
			const udp = parseUDPHeader(packetData, transportOffset);
			if (udp) {
				packet.udp = udp;
				const payloadOffset = transportOffset + 8; // UDP header size
				if (payloadOffset < packetData.length) {
					packet.payload = packetData.slice(payloadOffset);
				}
			}
		} else if (ipv4.protocol === 1) {
			// ICMP
			packet.protocol = 'ICMP';
		}
	} else if (ethernet.etherType === 0x0806) {
		// ARP
		packet.protocol = 'ARP';
	} else if (ethernet.etherType === 0x86dd) {
		// IPv6
		packet.protocol = 'IPv6';
	}

	return packet;
}

/**
 * 統計情報を計算
 */
function calculateStatistics(packets: ParsedPacket[]): PcapStatistics {
	const stats: PcapStatistics = {
		totalPackets: packets.length,
		totalBytes: 0,
		captureStartTime: packets[0]?.timestamp ?? 0,
		captureEndTime: packets[packets.length - 1]?.timestamp ?? 0,
		averagePacketSize: 0,
		protocolDistribution: {},
		sourceIps: {},
		destinationIps: {},
		sourcePorts: {},
		destinationPorts: {}
	};

	for (const packet of packets) {
		stats.totalBytes += packet.capturedLength;

		// プロトコル分布
		stats.protocolDistribution[packet.protocol] =
			(stats.protocolDistribution[packet.protocol] ?? 0) + 1;

		// IPアドレス分布
		if (packet.ipv4) {
			stats.sourceIps[packet.ipv4.sourceIp] = (stats.sourceIps[packet.ipv4.sourceIp] ?? 0) + 1;
			stats.destinationIps[packet.ipv4.destinationIp] =
				(stats.destinationIps[packet.ipv4.destinationIp] ?? 0) + 1;
		}

		// ポート番号分布
		if (packet.tcp) {
			stats.sourcePorts[packet.tcp.sourcePort] =
				(stats.sourcePorts[packet.tcp.sourcePort] ?? 0) + 1;
			stats.destinationPorts[packet.tcp.destinationPort] =
				(stats.destinationPorts[packet.tcp.destinationPort] ?? 0) + 1;
		} else if (packet.udp) {
			stats.sourcePorts[packet.udp.sourcePort] =
				(stats.sourcePorts[packet.udp.sourcePort] ?? 0) + 1;
			stats.destinationPorts[packet.udp.destinationPort] =
				(stats.destinationPorts[packet.udp.destinationPort] ?? 0) + 1;
		}
	}

	stats.averagePacketSize = stats.totalPackets > 0 ? stats.totalBytes / stats.totalPackets : 0;

	return stats;
}

/**
 * Pcapファイルを解析
 */
export async function parsePcapFile(arrayBuffer: ArrayBuffer): Promise<PcapAnalysisResult> {
	// ファイルサイズ制限（500MB）
	const MAX_FILE_SIZE = 500 * 1024 * 1024;
	if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
		throw new Error(`ファイルサイズが大きすぎます（最大${MAX_FILE_SIZE / 1024 / 1024}MB）`);
	}

	// グローバルヘッダーを解析
	const globalHeader = parseGlobalHeader(arrayBuffer);

	// マジックナンバー検証
	if (
		globalHeader.magicNumber !== 0xa1b2c3d4 &&
		globalHeader.magicNumber !== 0xd4c3b2a1 &&
		globalHeader.magicNumber !== 0xa1b23c4d &&
		globalHeader.magicNumber !== 0x4d3cb2a1
	) {
		throw new Error('無効なpcapファイル: マジックナンバーが一致しません');
	}

	const packets: ParsedPacket[] = [];
	let offset = 24; // グローバルヘッダーサイズ
	let packetIndex = 0;
	const MAX_PACKETS = 1000000; // 最大パケット数制限

	// パケットを順次解析
	while (offset + 16 <= arrayBuffer.byteLength && packetIndex < MAX_PACKETS) {
		const packetHeader = parsePacketHeader(arrayBuffer, offset, globalHeader.isLittleEndian);
		offset += 16;

		if (offset + packetHeader.capturedLength > arrayBuffer.byteLength) {
			break; // ファイル終端
		}

		// キャプチャ長の妥当性チェック
		if (packetHeader.capturedLength > globalHeader.snapLen || packetHeader.capturedLength === 0) {
			console.warn(
				`Invalid packet at offset ${offset}: capturedLength=${packetHeader.capturedLength}`
			);
			break;
		}

		const packetData = new Uint8Array(arrayBuffer, offset, packetHeader.capturedLength);
		const parsedPacket = parsePacketData(packetData, packetIndex, packetHeader);
		packets.push(parsedPacket);

		offset += packetHeader.capturedLength;
		packetIndex++;
	}

	// 統計情報を計算
	const statistics = calculateStatistics(packets);

	return {
		globalHeader,
		packets,
		statistics
	};
}

/**
 * リンク層タイプの名称を取得
 */
export function getLinkTypeName(linkType: number): string {
	const linkTypes: Record<number, string> = {
		0: 'NULL',
		1: 'Ethernet',
		6: 'Token Ring',
		7: 'ARCnet',
		8: 'SLIP',
		9: 'PPP',
		10: 'FDDI',
		100: 'ATM',
		101: 'Raw IP',
		105: 'IEEE 802.11',
		113: 'Linux cooked',
		127: 'IEEE 802.11 RadioTap',
		140: 'MTP2',
		141: 'MTP3',
		143: 'DOCSIS',
		144: 'IrDA',
		147: 'User 0',
		228: 'IPv4',
		229: 'IPv6'
	};

	return linkTypes[linkType] ?? `Unknown (${linkType})`;
}
