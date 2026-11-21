const browserTokens = [
	['Edge', /\b(?:Edg|EdgA|EdgiOS|Edge)\/([\d.]+)/],
	['Firefox', /\b(?:Firefox|FxiOS)\/([\d.]+)/],
	['Chrome', /\b(?:Chrome|CriOS)\/([\d.]+)/],
	['Safari', /\bVersion\/([\d.]+).*\bSafari\//]
] as const;

export function identifyBrowser(userAgent: string): {
	browserName: string;
	browserVersion: string;
} {
	for (const [browserName, pattern] of browserTokens) {
		const match = userAgent.match(pattern);
		if (match) return { browserName, browserVersion: match[1] };
	}
	return {
		browserName: userAgent.includes('Safari/') ? 'Safari' : 'Unknown',
		browserVersion: 'Unknown'
	};
}
