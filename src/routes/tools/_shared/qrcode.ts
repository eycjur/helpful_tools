const QR_CODE_SIZE = 600;

export function getQrCodeUrl(text: string): string {
	const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
	url.search = new URLSearchParams({
		size: `${QR_CODE_SIZE}x${QR_CODE_SIZE}`,
		ecc: 'H',
		margin: '6',
		data: text
	}).toString();
	return url.href;
}

export function loadQrImage(src: string, cors = false): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		if (cors) image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

export async function loadQrCodeImage(src: string, cors = false): Promise<HTMLImageElement> {
	const image = await loadQrImage(src, cors);
	// QRServer may return a smaller error image with a successful HTTP status.
	if (image.naturalWidth !== QR_CODE_SIZE || image.naturalHeight !== QR_CODE_SIZE)
		throw new Error('QRコード画像の生成に失敗しました。入力が長い場合は短くしてください。');
	return image;
}

export async function fetchQrBlob(url: string): Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`QRコード画像の取得に失敗しました (${response.status})`);
	const blob = await response.blob();
	const blobUrl = URL.createObjectURL(blob);
	try {
		await loadQrCodeImage(blobUrl);
		return blob;
	} finally {
		URL.revokeObjectURL(blobUrl);
	}
}
