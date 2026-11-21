export function detectBase64ImageMimeType(base64: string): string | undefined {
	const header = atob(base64.replace(/[\t\n\f\r ]/g, '').slice(0, 16));
	if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
	if (header.startsWith('\xff\xd8\xff')) return 'image/jpeg';
	if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
	if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return 'image/webp';
}

export function imageFileExtension(mimeType: string): string {
	const subtype = mimeType.split('/')[1]?.split(/[+;]/)[0];
	return subtype === 'jpeg' ? 'jpg' : subtype || 'png';
}
