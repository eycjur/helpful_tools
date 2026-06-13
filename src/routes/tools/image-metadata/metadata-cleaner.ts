// JPEG: APP11 (0xFFEB) セグメントを除去してC2PAマニフェストを削除
export async function removeJpegC2pa(file: File): Promise<Blob> {
	const arrayBuffer = await file.arrayBuffer();
	const data = new Uint8Array(arrayBuffer);

	if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Invalid JPEG');

	const keptSegments: Uint8Array[] = [data.slice(0, 2)]; // SOI
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

		if (marker === 0xeb) {
			// APP11: C2PA JUMBF — スキップ
			modified = true;
		} else {
			keptSegments.push(data.slice(pos, segEnd));
		}

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

// C2PAメタデータ削除のメインエントリ
export async function removeC2paMetadata(file: File): Promise<Blob> {
	if (file.type === 'image/jpeg') {
		return removeJpegC2pa(file);
	} else if (file.type === 'image/png') {
		return removePngC2pa(file);
	} else {
		// WebP等はCanvasで全削除
		return removeAllMetadataViaCanvas(file);
	}
}

export function getCleanFileName(originalName: string, suffix: string): string {
	const dotIdx = originalName.lastIndexOf('.');
	if (dotIdx === -1) return `${originalName}_${suffix}`;
	return `${originalName.substring(0, dotIdx)}_${suffix}${originalName.substring(dotIdx)}`;
}
