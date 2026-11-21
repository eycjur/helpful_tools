export function hasValidVideoLimits(maxWidth: number, maxHeight: number): boolean {
	return (
		Number.isInteger(maxWidth) &&
		maxWidth >= 1 &&
		maxWidth <= 7680 &&
		Number.isInteger(maxHeight) &&
		maxHeight >= 1 &&
		maxHeight <= 4320
	);
}

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
