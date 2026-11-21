export function getQrCodeUrl(text: string): string {
	const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
	url.search = new URLSearchParams({
		size: '600x600',
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

export async function fetchQrBlob(url: string): Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`QRコード画像の取得に失敗しました (${response.status})`);
	return response.blob();
}
