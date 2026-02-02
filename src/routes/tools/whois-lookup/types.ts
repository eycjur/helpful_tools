/**
 * Whois/ドメイン調査 - 型定義
 */

export interface DNSRecord {
	name: string;
	type: string;
	data: string;
	ttl?: number;
}

export interface IPGeoInfo {
	ip: string;
	city: string;
	region: string;
	country: string;
	countryCode: string;
	timezone: string;
	latitude: number;
	longitude: number;
	org: string;
	postal: string;
	// 拡張フィールド
	isp?: string;
	as?: string;
	asname?: string;
	reverse?: string;
	mobile?: boolean;
	proxy?: boolean;
	hosting?: boolean;
}

export interface IPAnalysis {
	version: 'IPv4' | 'IPv6';
	isPrivate: boolean;
	isLoopback: boolean;
	isLinkLocal: boolean;
	isMulticast: boolean;
	ipClass?: 'A' | 'B' | 'C' | 'D' | 'E';
	binary?: string;
	hex?: string;
}

export interface DomainInfo {
	domain: string;
	isIP: boolean;
	isSubdomain: boolean;
	rootDomain?: string;
	dnsRecords: DNSRecord[];
	rootDnsRecords?: DNSRecord[];
	ipGeoInfo?: IPGeoInfo;
	rootIpGeoInfo?: IPGeoInfo;
	ipAnalysis?: IPAnalysis;
	registrationInfo?: Record<string, unknown>;
	error?: string;
}
