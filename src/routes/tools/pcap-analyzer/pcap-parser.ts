/**
 * Pcap/Pcapng ファイルパーサー
 * キャプチャファイルのバイナリ解析と統計情報抽出
 */

const PCAPNG_MAGIC = 0x0a0d0d0a;
const MAX_PACKETS = 1_000_000;

export type PcapGlobalHeader = {
	magicNumber: number;
	versionMajor: number;
	versionMinor: number;
	thisZone: number;
	sigFigs: number;
	snapLen: number | null;
	network: number | null;
	isLittleEndian: boolean;
};

type PacketHeader = {
	timestamp: number | null;
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

export type DNSHeader = {
	transactionId: number;
	flags: number;
	isResponse: boolean;
	questionCount: number;
	answerCount: number;
};

export type DNSInfo = {
	queryName?: string;
	queryType?: number;
	answers?: Array<{ name: string; type: number; data: string }>;
};

export type ParsedPacket = {
	index: number;
	timestamp: number | null;
	capturedLength: number;
	originalLength: number;
	ethernet?: EthernetFrame;
	ipv4?: IPv4Header;
	tcp?: TCPHeader;
	udp?: UDPHeader;
	dns?: DNSInfo;
	protocol: 'TCP' | 'UDP' | 'ICMP' | 'ARP' | 'IPv6' | 'Other';
	payload?: Uint8Array;
};

export type PcapStatistics = {
	totalPackets: number;
	totalBytes: number;
	captureStartTime: number | null;
	captureEndTime: number | null;
	averagePacketSize: number;
	protocolDistribution: Record<string, number>;
	sourceIps: Record<string, number>;
	destinationIps: Record<string, number>;
	sourcePorts: Record<number, number>;
	destinationPorts: Record<number, number>;
};

export type PcapAnalysisResult = {
	format: 'pcap' | 'pcapng';
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
		network: view.getUint32(20, isLittleEndian) & 0xffff,
		isLittleEndian
	};
}

/**
 * パケットヘッダーを解析
 */
function parsePacketHeader(
	buffer: ArrayBuffer,
	offset: number,
	isLittleEndian: boolean,
	timestampDivisor: number
): PacketHeader {
	const view = new DataView(buffer, offset, 16);
	return {
		timestamp:
			view.getUint32(0, isLittleEndian) + view.getUint32(4, isLittleEndian) / timestampDivisor,
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

	const totalLength = (packetData[offset + 2]! << 8) | packetData[offset + 3]!;
	const protocol = packetData[offset + 9]!;
	// Windows LSOv2で分割前にキャプチャされたTCPパケットは全長が0になる。
	const hasOffloadLength = totalLength === 0 && protocol === 6;
	if (
		version !== 4 ||
		ihl < 5 ||
		offset + ihl * 4 > packetData.length ||
		(!hasOffloadLength && totalLength < ihl * 4)
	) {
		return null;
	}

	return {
		version,
		ihl,
		tos: packetData[offset + 1]!,
		totalLength,
		identification: (packetData[offset + 4]! << 8) | packetData[offset + 5]!,
		flags: (packetData[offset + 6]! >> 5) & 0x07,
		fragmentOffset: ((packetData[offset + 6]! & 0x1f) << 8) | packetData[offset + 7]!,
		ttl: packetData[offset + 8]!,
		protocol,
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
	const dataOffset = (packetData[offset + 12]! >> 4) & 0x0f;
	if (dataOffset < 5 || packetData.length < offset + dataOffset * 4) return null;
	const view = new DataView(packetData.buffer, packetData.byteOffset + offset, 20);

	return {
		sourcePort: (packetData[offset]! << 8) | packetData[offset + 1]!,
		destinationPort: (packetData[offset + 2]! << 8) | packetData[offset + 3]!,
		sequenceNumber: view.getUint32(4),
		acknowledgmentNumber: view.getUint32(8),
		dataOffset,
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
	const length = (packetData[offset + 4]! << 8) | packetData[offset + 5]!;
	if (length < 8) return null;

	return {
		sourcePort: (packetData[offset]! << 8) | packetData[offset + 1]!,
		destinationPort: (packetData[offset + 2]! << 8) | packetData[offset + 3]!,
		length,
		checksum: (packetData[offset + 6]! << 8) | packetData[offset + 7]!
	};
}

/**
 * DNSドメイン名を解析（ラベル形式）
 * 圧縮ポインタ（0xC0）にも対応
 */
function parseDNSName(data: Uint8Array, offset: number): { name: string; newOffset: number } {
	const labels: string[] = [];
	let pos = offset;
	let jumped = false;
	let jumpOffset = 0;
	const MAX_JUMPS = 10; // 無限ループ防止
	let jumps = 0;

	while (pos < data.length && jumps < MAX_JUMPS) {
		const length = data[pos]!;

		// 終端（長さ0）
		if (length === 0) {
			pos++;
			break;
		}

		// 圧縮ポインタ（先頭2ビットが11）
		if ((length & 0xc0) === 0xc0) {
			if (pos + 1 >= data.length) break;
			const pointer = ((length & 0x3f) << 8) | data[pos + 1]!;
			if (!jumped) {
				jumpOffset = pos + 2;
			}
			pos = pointer;
			jumped = true;
			jumps++;
			continue;
		}

		// 通常のラベル
		if (pos + length >= data.length) break;
		const label = String.fromCharCode(...Array.from(data.slice(pos + 1, pos + 1 + length)));
		labels.push(label);
		pos += length + 1;
	}

	return {
		name: labels.join('.') + (labels.length > 0 ? '.' : ''),
		newOffset: jumped ? jumpOffset : pos
	};
}

/**
 * DNS情報を解析（Question + Answer）
 */
function parseDNS(payload: Uint8Array): DNSInfo | null {
	if (payload.length < 12) return null; // DNSヘッダー最小サイズ

	// DNSヘッダー解析
	const flags = (payload[2]! << 8) | payload[3]!;
	const isResponse = (flags & 0x8000) !== 0;
	const questionCount = (payload[4]! << 8) | payload[5]!;
	const answerCount = (payload[6]! << 8) | payload[7]!;

	const dnsInfo: DNSInfo = {};
	let offset = 12; // DNSヘッダー終了位置

	// Question Section解析
	if (questionCount > 0 && offset < payload.length) {
		const { name, newOffset } = parseDNSName(payload, offset);
		dnsInfo.queryName = name;
		offset = newOffset;

		if (offset + 4 <= payload.length) {
			dnsInfo.queryType = (payload[offset]! << 8) | payload[offset + 1]!;
			offset += 4; // QTYPE + QCLASS
		}
	}

	// Answer Section解析（レスポンスの場合）
	if (isResponse && answerCount > 0) {
		dnsInfo.answers = [];

		for (let i = 0; i < Math.min(answerCount, 10) && offset < payload.length; i++) {
			// 無限ループ防止で最大10件
			const { name, newOffset } = parseDNSName(payload, offset);
			offset = newOffset;

			if (offset + 10 > payload.length) break;

			const type = (payload[offset]! << 8) | payload[offset + 1]!;
			const rdlength = (payload[offset + 8]! << 8) | payload[offset + 9]!;
			offset += 10; // TYPE + CLASS + TTL + RDLENGTH

			if (offset + rdlength > payload.length) break;

			let data = '';
			if (type === 1 && rdlength === 4) {
				// A record (IPv4)
				data = `${payload[offset]}.${payload[offset + 1]}.${payload[offset + 2]}.${payload[offset + 3]}`;
			} else if (type === 28 && rdlength === 16) {
				// AAAA record (IPv6)
				const parts: string[] = [];
				for (let j = 0; j < 16; j += 2) {
					parts.push(
						((payload[offset + j]! << 8) | payload[offset + j + 1]!).toString(16).padStart(4, '0')
					);
				}
				data = parts.join(':');
			} else if (type === 5) {
				// CNAME
				const { name: cname } = parseDNSName(payload, offset);
				data = cname;
			}

			dnsInfo.answers.push({ name, type, data });
			offset += rdlength;
		}
	}

	return dnsInfo;
}

/**
 * パケットデータを解析
 */
function parsePacketData(
	packetData: Uint8Array,
	index: number,
	header: PacketHeader,
	linkType: number | null
): ParsedPacket {
	const packet: ParsedPacket = {
		index,
		timestamp: header.timestamp,
		capturedLength: header.capturedLength,
		originalLength: header.originalLength,
		protocol: 'Other'
	};

	// Ethernetフレームを解析
	if (linkType !== 1) return packet;
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
		const ipData =
			ipv4.totalLength === 0 ? packetData : packetData.subarray(0, ipOffset + ipv4.totalLength);

		// プロトコル判定
		if (ipv4.protocol === 6) {
			// TCP
			packet.protocol = 'TCP';
			if (ipv4.fragmentOffset !== 0) return packet;
			const tcp = parseTCPHeader(ipData, transportOffset);
			if (tcp) {
				packet.tcp = tcp;
				const payloadOffset = transportOffset + tcp.dataOffset * 4;
				if (payloadOffset < ipData.length) {
					packet.payload = ipData.slice(payloadOffset);
				}
			}
		} else if (ipv4.protocol === 17) {
			// UDP
			packet.protocol = 'UDP';
			if (ipv4.fragmentOffset !== 0) return packet;
			const udp = parseUDPHeader(ipData, transportOffset);
			if (udp) {
				packet.udp = udp;
				const payloadOffset = transportOffset + 8; // UDP header size
				const payloadEnd = Math.min(ipData.length, transportOffset + udp.length);
				if (payloadOffset < payloadEnd) {
					packet.payload = ipData.slice(payloadOffset, payloadEnd);

					// DNS解析（port 53）
					if (udp.sourcePort === 53 || udp.destinationPort === 53) {
						const dnsInfo = parseDNS(packet.payload);
						if (dnsInfo) {
							packet.dns = dnsInfo;
						}
					}
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
		captureStartTime: null,
		captureEndTime: null,
		averagePacketSize: 0,
		protocolDistribution: {},
		sourceIps: {},
		destinationIps: {},
		sourcePorts: {},
		destinationPorts: {}
	};

	for (const packet of packets) {
		stats.totalBytes += packet.capturedLength;
		if (packet.timestamp !== null) {
			stats.captureStartTime = Math.min(
				stats.captureStartTime ?? packet.timestamp,
				packet.timestamp
			);
			stats.captureEndTime = Math.max(stats.captureEndTime ?? packet.timestamp, packet.timestamp);
		}

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
function parseClassicPcap(arrayBuffer: ArrayBuffer): PcapAnalysisResult {
	if (arrayBuffer.byteLength < 24)
		throw new Error('無効なpcapファイル: ヘッダーが途中で終わっています');
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
	const isNanosecond =
		globalHeader.magicNumber === 0xa1b23c4d || globalHeader.magicNumber === 0x4d3cb2a1;
	const timestampDivisor = isNanosecond ? 1_000_000_000 : 1_000_000;
	let offset = 24; // グローバルヘッダーサイズ

	// パケットを順次解析
	while (offset + 16 <= arrayBuffer.byteLength && packets.length < MAX_PACKETS) {
		const packetHeader = parsePacketHeader(
			arrayBuffer,
			offset,
			globalHeader.isLittleEndian,
			timestampDivisor
		);
		offset += 16;

		if (offset + packetHeader.capturedLength > arrayBuffer.byteLength) {
			break; // ファイル終端
		}

		// キャプチャ長の妥当性チェック
		if (
			packetHeader.capturedLength > (globalHeader.snapLen ?? 0) ||
			packetHeader.capturedLength === 0
		) {
			console.warn(
				`Invalid packet at offset ${offset}: capturedLength=${packetHeader.capturedLength}`
			);
			break;
		}

		const packetData = new Uint8Array(arrayBuffer, offset, packetHeader.capturedLength);
		const parsedPacket = parsePacketData(
			packetData,
			packets.length,
			packetHeader,
			globalHeader.network
		);
		packets.push(parsedPacket);

		offset += packetHeader.capturedLength;
	}

	// 統計情報を計算
	const statistics = calculateStatistics(packets);

	return {
		format: 'pcap',
		globalHeader,
		packets,
		statistics
	};
}

type PcapngInterface = {
	linkType: number;
	snapLen: number;
	timestampUnit: number;
	timestampOffset: number;
};

const pcapngError = '無効なpcapngファイル';
const paddedLength = (length: number) => Math.ceil(length / 4) * 4;

function parsePcapngInterface(view: DataView, littleEndian: boolean): PcapngInterface {
	if (view.byteLength < 8) throw new Error(`${pcapngError}: インターフェース情報が不完全です`);
	const info = {
		linkType: view.getUint16(0, littleEndian),
		snapLen: view.getUint32(4, littleEndian),
		timestampUnit: 1e-6,
		timestampOffset: 0
	};

	for (let offset = 8; offset + 4 <= view.byteLength; ) {
		const code = view.getUint16(offset, littleEndian);
		if (code === 0) break;
		const size = view.getUint16(offset + 2, littleEndian);
		const valueOffset = offset + 4;
		offset = valueOffset + paddedLength(size);
		if (offset > view.byteLength) throw new Error(`${pcapngError}: オプションの長さが不正です`);

		if (code === 9 && size === 1) {
			const resolution = view.getUint8(valueOffset);
			info.timestampUnit = resolution < 128 ? 10 ** -resolution : 2 ** -(resolution - 128);
		} else if (code === 14 && size === 8) {
			info.timestampOffset = Number(view.getBigInt64(valueOffset, littleEndian));
		}
	}
	return info;
}

function parsePcapng(buffer: ArrayBuffer): PcapAnalysisResult {
	const view = new DataView(buffer);
	const packets: ParsedPacket[] = [];
	const linkTypes = new Set<number>();
	const snapLengths = new Set<number>();
	let globalHeader: PcapGlobalHeader | undefined;
	let interfaces: PcapngInterface[] = [];
	let littleEndian = true;

	for (let offset = 0; offset < buffer.byteLength && packets.length < MAX_PACKETS; ) {
		if (buffer.byteLength - offset < 12) throw new Error(`${pcapngError}: ブロックが不完全です`);
		const isSectionHeader = view.getUint32(offset) === PCAPNG_MAGIC;
		if (isSectionHeader) {
			const byteOrder = view.getUint32(offset + 8);
			if (byteOrder !== 0x1a2b3c4d && byteOrder !== 0x4d3c2b1a) {
				throw new Error(`${pcapngError}: バイト順序マジックが不正です`);
			}
			littleEndian = byteOrder === 0x4d3c2b1a;
		}

		const type = view.getUint32(offset, littleEndian);
		const length = view.getUint32(offset + 4, littleEndian);
		const end = offset + length;
		if (
			length < 12 ||
			length % 4 !== 0 ||
			end > buffer.byteLength ||
			view.getUint32(end - 4, littleEndian) !== length
		) {
			throw new Error(`${pcapngError}: ブロックの長さが不正です`);
		}
		const body = new DataView(buffer, offset + 8, length - 12);
		offset = end;

		if (isSectionHeader) {
			if (body.byteLength < 16) throw new Error(`${pcapngError}: セクションヘッダーが不完全です`);
			const versionMajor = body.getUint16(4, littleEndian);
			const versionMinor = body.getUint16(6, littleEndian);
			if (versionMajor !== 1) throw new Error(`${pcapngError}: 未対応のバージョンです`);
			interfaces = [];
			globalHeader ??= {
				magicNumber: PCAPNG_MAGIC,
				versionMajor,
				versionMinor,
				thisZone: 0,
				sigFigs: 0,
				network: null,
				snapLen: null,
				isLittleEndian: littleEndian
			};
		} else if (type === 1) {
			const info = parsePcapngInterface(body, littleEndian);
			interfaces.push(info);
			linkTypes.add(info.linkType);
			snapLengths.add(info.snapLen);
		} else if (type === 2 || type === 3 || type === 6) {
			// Packet Block / Simple Packet Block / Enhanced Packet Block
			const simple = type === 3;
			const dataOffset = simple ? 4 : 20;
			if (body.byteLength < dataOffset) throw new Error(`${pcapngError}: パケット情報が不完全です`);
			const interfaceId = simple
				? 0
				: type === 2
					? body.getUint16(0, littleEndian)
					: body.getUint32(0, littleEndian);
			const info = interfaces[interfaceId];
			if (!info) throw new Error(`${pcapngError}: パケットのインターフェースが定義されていません`);

			const originalLength = body.getUint32(simple ? 0 : 16, littleEndian);
			const capturedLength = simple
				? Math.min(originalLength, info.snapLen || originalLength)
				: body.getUint32(12, littleEndian);
			if (dataOffset + paddedLength(capturedLength) > body.byteLength) {
				throw new Error(`${pcapngError}: パケットの長さが不正です`);
			}
			let timestamp: number | null = null;
			if (!simple) {
				const high = body.getUint32(4, littleEndian);
				const low = body.getUint32(8, littleEndian);
				timestamp = (high * 2 ** 32 + low) * info.timestampUnit + info.timestampOffset;
			}
			const data = new Uint8Array(buffer, body.byteOffset + dataOffset, capturedLength);
			packets.push(
				parsePacketData(
					data,
					packets.length,
					{ timestamp, capturedLength, originalLength },
					info.linkType
				)
			);
		}
	}

	if (!globalHeader) throw new Error(`${pcapngError}: セクションヘッダーがありません`);
	if (linkTypes.size === 1) globalHeader.network = linkTypes.values().next().value ?? null;
	if (snapLengths.size === 1) globalHeader.snapLen = snapLengths.values().next().value ?? null;
	return { format: 'pcapng', globalHeader, packets, statistics: calculateStatistics(packets) };
}

export async function parsePcapFile(arrayBuffer: ArrayBuffer): Promise<PcapAnalysisResult> {
	return arrayBuffer.byteLength >= 4 && new DataView(arrayBuffer).getUint32(0) === PCAPNG_MAGIC
		? parsePcapng(arrayBuffer)
		: parseClassicPcap(arrayBuffer);
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
