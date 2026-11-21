const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv'];

export const videoFileAccept = ['video/*', ...videoExtensions].join(',');

export function isVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
	if (file.type.startsWith('video/')) return true;
	if (file.type !== '' && file.type !== 'application/octet-stream') return false;
	const name = file.name.toLowerCase();
	return videoExtensions.some((extension) => name.endsWith(extension));
}
