/**
 * Xのユーザー名検証
 *
 * X（旧Twitter）のユーザー名仕様：
 * - 英数字とアンダースコアのみ
 * - 15文字以内
 * - @プレフィックスはオプション
 */

// ユーザー名検証（英数字とアンダースコアのみ、15文字以内）
const X_USERNAME_REGEX = /^[a-zA-Z0-9_]{1,15}$/;

export function validateUsername(name: string): boolean {
	const clean = name.startsWith('@') ? name.slice(1) : name;
	return X_USERNAME_REGEX.test(clean);
}

export function cleanUsername(name: string): string {
	return name.startsWith('@') ? name.slice(1) : name;
}
