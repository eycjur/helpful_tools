import { describe, expect, it } from 'vitest';
import { identifyBrowser } from './browser-info';

describe('identifyBrowser', () => {
	it.each([
		['Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0', 'Edge', '120.0.0.0'],
		['Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0', 'Edge', '120.0.0.0'],
		['Version/17.0 EdgiOS/120.0 Mobile/15E148 Safari/605.1.15', 'Edge', '120.0'],
		['CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1', 'Chrome', '56.0.2924.75'],
		['FxiOS/102.2 Mobile/15E148 Safari/605.1.15', 'Firefox', '102.2'],
		['Version/17.0 Mobile/15E148 Safari/605.1.15', 'Safari', '17.0'],
		['Gecko/20100101 Firefox/133.0', 'Firefox', '133.0'],
		['Chrome/120.0.0.0 Safari/537.36', 'Chrome', '120.0.0.0'],
		['Application/1.0', 'Unknown', 'Unknown']
	])('UA %s から %s %s を判別する', (userAgent, browserName, browserVersion) => {
		expect(identifyBrowser(userAgent)).toEqual({ browserName, browserVersion });
	});
});
