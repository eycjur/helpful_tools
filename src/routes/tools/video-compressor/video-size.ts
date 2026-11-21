export function calculateAspectRatioConstrainedSize(
	originalWidth: number,
	originalHeight: number,
	maxWidth: number,
	maxHeight: number
): { width: number; height: number } {
	const scale = Math.min(1, maxWidth / originalWidth, maxHeight / originalHeight);
	return {
		width: Math.max(1, Math.round(originalWidth * scale)),
		height: Math.max(1, Math.round(originalHeight * scale))
	};
}
