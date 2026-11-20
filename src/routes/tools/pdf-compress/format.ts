/** バイト数を B/KB/MB/GB で表示 */
export function formatSize(bytes: number): string {
	if (bytes === 0 || isNaN(bytes)) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
