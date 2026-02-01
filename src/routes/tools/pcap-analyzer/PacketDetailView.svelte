<script lang="ts">
	import type { ParsedPacket } from './pcap-parser';

	export let packet: ParsedPacket;

	function formatHexDump(data: Uint8Array | undefined): string {
		if (!data || data.length === 0) return '';

		const lines: string[] = [];
		const maxBytes = Math.min(data.length, 512);

		for (let i = 0; i < maxBytes; i += 16) {
			const offset = i.toString(16).padStart(8, '0');
			const chunk = data.slice(i, Math.min(i + 16, maxBytes));

			const hex = Array.from(chunk)
				.map((b, idx) => {
					const h = b.toString(16).padStart(2, '0');
					return idx === 7 ? h + '  ' : h + ' ';
				})
				.join('')
				.padEnd(50, ' ');

			const ascii = Array.from(chunk)
				.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
				.join('');

			lines.push(`${offset}  ${hex} |${ascii}|`);
		}

		if (data.length > maxBytes) {
			lines.push(`... (${data.length - maxBytes} bytes omitted)`);
		}

		return lines.join('\n');
	}

	function getTcpFlags(flags: number): string {
		const flagList = [];
		if (flags & 0x02) flagList.push('SYN');
		if (flags & 0x10) flagList.push('ACK');
		if (flags & 0x01) flagList.push('FIN');
		if (flags & 0x04) flagList.push('RST');
		if (flags & 0x08) flagList.push('PSH');
		return flagList.join(',');
	}
</script>

<div class="space-y-4">
	<!-- Ethernet -->
	{#if packet.ethernet}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">Ethernet</h4>
			<dl class="grid grid-cols-2 gap-2 text-sm">
				<div>
					<dt class="font-medium text-gray-600">Source MAC:</dt>
					<dd class="font-mono text-gray-900">{packet.ethernet.sourceMac}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Destination MAC:</dt>
					<dd class="font-mono text-gray-900">{packet.ethernet.destinationMac}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">EtherType:</dt>
					<dd class="font-mono text-gray-900">
						0x{packet.ethernet.etherType.toString(16).padStart(4, '0')}
					</dd>
				</div>
			</dl>
		</div>
	{/if}

	<!-- IPv4 -->
	{#if packet.ipv4}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">IPv4</h4>
			<dl class="grid grid-cols-2 gap-2 text-sm">
				<div>
					<dt class="font-medium text-gray-600">Source IP:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.sourceIp}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Destination IP:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.destinationIp}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Protocol:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.protocol}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">TTL:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.ttl}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Total Length:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.totalLength}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Identification:</dt>
					<dd class="font-mono text-gray-900">{packet.ipv4.identification}</dd>
				</div>
			</dl>
		</div>
	{/if}

	<!-- TCP -->
	{#if packet.tcp}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">TCP</h4>
			<dl class="grid grid-cols-2 gap-2 text-sm">
				<div>
					<dt class="font-medium text-gray-600">Source Port:</dt>
					<dd class="font-mono text-gray-900">{packet.tcp.sourcePort}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Destination Port:</dt>
					<dd class="font-mono text-gray-900">{packet.tcp.destinationPort}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Sequence Number:</dt>
					<dd class="font-mono text-gray-900">{packet.tcp.sequenceNumber}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Acknowledgment:</dt>
					<dd class="font-mono text-gray-900">{packet.tcp.acknowledgmentNumber}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Flags:</dt>
					<dd class="font-mono text-gray-900">
						0x{packet.tcp.flags.toString(16).padStart(2, '0')} ({getTcpFlags(packet.tcp.flags)})
					</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Window Size:</dt>
					<dd class="font-mono text-gray-900">{packet.tcp.windowSize}</dd>
				</div>
			</dl>
		</div>
	{/if}

	<!-- UDP -->
	{#if packet.udp}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">UDP</h4>
			<dl class="grid grid-cols-2 gap-2 text-sm">
				<div>
					<dt class="font-medium text-gray-600">Source Port:</dt>
					<dd class="font-mono text-gray-900">{packet.udp.sourcePort}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Destination Port:</dt>
					<dd class="font-mono text-gray-900">{packet.udp.destinationPort}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Length:</dt>
					<dd class="font-mono text-gray-900">{packet.udp.length}</dd>
				</div>
				<div>
					<dt class="font-medium text-gray-600">Checksum:</dt>
					<dd class="font-mono text-gray-900">
						0x{packet.udp.checksum.toString(16).padStart(4, '0')}
					</dd>
				</div>
			</dl>
		</div>
	{/if}

	<!-- DNS -->
	{#if packet.dns}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">DNS</h4>
			<dl class="grid grid-cols-1 gap-2 text-sm">
				{#if packet.dns.queryName}
					<div>
						<dt class="font-medium text-gray-600">Query Name:</dt>
						<dd class="font-mono text-gray-900">{packet.dns.queryName}</dd>
					</div>
				{/if}
				{#if packet.dns.queryType}
					<div>
						<dt class="font-medium text-gray-600">Query Type:</dt>
						<dd class="font-mono text-gray-900">
							{packet.dns.queryType === 1
								? 'A (IPv4)'
								: packet.dns.queryType === 28
									? 'AAAA (IPv6)'
									: packet.dns.queryType === 5
										? 'CNAME'
										: `Type ${packet.dns.queryType}`}
						</dd>
					</div>
				{/if}
				{#if packet.dns.answers && packet.dns.answers.length > 0}
					<div>
						<dt class="font-medium text-gray-600">Answers:</dt>
						<dd class="space-y-1">
							{#each packet.dns.answers as answer}
								<div class="font-mono text-xs text-gray-900">{answer.name} → {answer.data}</div>
							{/each}
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Payload (Hex Dump) -->
	{#if packet.payload && packet.payload.length > 0}
		<div>
			<h4 class="mb-2 font-semibold text-gray-800">Payload ({packet.payload.length} bytes)</h4>
			<pre
				class="overflow-x-auto rounded bg-gray-900 p-4 font-mono text-xs text-green-400">{formatHexDump(
					packet.payload
				)}</pre>
		</div>
	{/if}
</div>
