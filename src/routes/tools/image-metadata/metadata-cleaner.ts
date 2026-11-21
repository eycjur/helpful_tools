const C2PA_JUMBF_UUID = new Uint8Array([
	0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71
]);

function isC2paJumbfStart(packet: DataView): boolean {
	const boxOffset = 8; // JPEG XT の CI、En、Z フィールドの後
	if (packet.byteLength < boxOffset + 8 || packet.getUint32(boxOffset + 4) !== 0x6a756d62)
		return false; // jumb

	const description = boxOffset + (packet.getUint32(boxOffset) === 1 ? 16 : 8);
	if (packet.byteLength < description + 8 || packet.getUint32(description + 4) !== 0x6a756d64)
		return false; // jumd

	const uuid = description + (packet.getUint32(description) === 1 ? 16 : 8);
	const label = uuid + C2PA_JUMBF_UUID.length + 1; // UUID に続くトグルバイトの後
	return (
		packet.byteLength >= label + 5 &&
		C2PA_JUMBF_UUID.every((byte, index) => packet.getUint8(uuid + index) === byte) &&
		packet.getUint32(label) === 0x63327061 && // c2pa
		packet.getUint8(label + 4) === 0
	);
}

// JPEG: C2PAマニフェストを含むAPP11セグメントのみ除去
export async function removeJpegC2pa(file: File): Promise<Blob> {
	const arrayBuffer = await file.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Invalid JPEG');

	const keptSegments: Uint8Array[] = [data.slice(0, 2)]; // SOI
	const c2paPackets = new Map<number, number>();
	let pos = 2;
	let modified = false;

	while (pos < data.length - 1) {
		if (data[pos] !== 0xff) {
			// マーカーでない = 画像データの残り
			keptSegments.push(data.slice(pos));
			break;
		}

		const marker = data[pos + 1];

		// SOS (0xDA): 以降は全て画像データ
		if (marker === 0xda) {
			keptSegments.push(data.slice(pos));
			break;
		}

		// EOI (0xD9): そのまま追加して終了
		if (marker === 0xd9) {
			keptSegments.push(data.slice(pos, pos + 2));
			break;
		}

		// 長さフィールドのないマーカー（RSTn 等）
		if (marker >= 0xd0 && marker <= 0xd7) {
			keptSegments.push(data.slice(pos, pos + 2));
			pos += 2;
			continue;
		}

		if (pos + 4 > data.length) break;
		const segLength = (data[pos + 2] << 8) | data[pos + 3];
		const segEnd = pos + 2 + segLength;

		if (segEnd > data.length) break;

		if (marker === 0xeb && segLength >= 18) {
			const packet = new DataView(arrayBuffer, pos + 4, segLength - 2);
			if (packet.getUint16(0) === 0x4a50) {
				const instance = packet.getUint16(2);
				const sequence = packet.getUint32(4);
				if (sequence === 1 ? isC2paJumbfStart(packet) : c2paPackets.get(instance) === sequence) {
					c2paPackets.set(instance, sequence + 1);
					modified = true;
					pos = segEnd;
					continue;
				}
			}
		}

		keptSegments.push(data.slice(pos, segEnd));
		pos = segEnd;
	}

	if (!modified) return file;

	const totalLength = keptSegments.reduce((acc, s) => acc + s.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const seg of keptSegments) {
		result.set(seg, offset);
		offset += seg.length;
	}

	return new Blob([result], { type: 'image/jpeg' });
}

// PNG: caBX チャンク（C2PA CAI Box）を除去
export async function removePngC2pa(file: File): Promise<Blob> {
	const arrayBuffer = await file.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
	for (let i = 0; i < 8; i++) {
		if (data[i] !== PNG_SIG[i]) throw new Error('PNG シグネチャが不正です');
	}

	const decoder = new TextDecoder('latin1');
	const keptChunks: Uint8Array[] = [data.slice(0, 8)];
	let pos = 8;
	let modified = false;
	let foundIend = false;

	while (pos < data.length) {
		if (pos + 12 > data.length) break;

		const length =
			((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0;

		// 境界チェック
		if (pos + 12 + length > data.length) {
			throw new Error('PNG チャンク長が不正です（ファイルが破損している可能性があります）');
		}

		const type = decoder.decode(data.slice(pos + 4, pos + 8));

		if (type === 'caBX') {
			// C2PA CAI Box チャンク — スキップ
			modified = true;
		} else {
			keptChunks.push(data.slice(pos, pos + 12 + length));
		}

		pos += 12 + length;

		if (type === 'IEND') {
			foundIend = true;
			break;
		}
	}

	if (!foundIend) return file;
	if (!modified) return file;

	const totalLength = keptChunks.reduce((acc, c) => acc + c.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of keptChunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return new Blob([result], { type: 'image/png' });
}

// Canvas再描画による全メタデータ削除
export async function removeAllMetadataViaCanvas(file: File): Promise<Blob> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
			img.src = url;
		});

		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas context の取得に失敗しました');
		ctx.drawImage(img, 0, 0);

		const mimeType =
			file.type === 'image/png'
				? 'image/png'
				: file.type === 'image/webp'
					? 'image/webp'
					: 'image/jpeg';
		const quality = mimeType === 'image/jpeg' ? 0.95 : undefined;

		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error('画像変換に失敗しました'));
				},
				mimeType,
				quality
			);
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function canRemoveC2paMetadata(file: File): boolean {
	return file.type === 'image/jpeg' || file.type === 'image/png';
}

// C2PAメタデータのみ削除
export async function removeC2paMetadata(file: File): Promise<Blob> {
	if (file.type === 'image/jpeg') return removeJpegC2pa(file);
	if (file.type === 'image/png') return removePngC2pa(file);
	throw new Error('C2PAのみ削除できる形式はJPEGとPNGです');
}

export function getCleanFileName(originalName: string, suffix: string, mimeType: string): string {
	const dotIdx = originalName.lastIndexOf('.');
	const stem = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;
	const originalExt = dotIdx > 0 ? originalName.slice(dotIdx) : '';
	const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
	const originalType = originalExt.toLowerCase() === '.jpeg' ? '.jpg' : originalExt.toLowerCase();
	const outputExt = originalType === `.${extension}` ? originalExt : `.${extension}`;
	return `${stem}_${suffix}${outputExt}`;
}
