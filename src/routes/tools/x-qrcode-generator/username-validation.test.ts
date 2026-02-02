import { describe, it, expect } from 'vitest';
import { validateUsername, cleanUsername } from './username-validation';

describe('validateUsername', () => {
	describe('有効なユーザー名', () => {
		it('英数字のみのユーザー名を許可する', () => {
			expect(validateUsername('testuser')).toBe(true);
			expect(validateUsername('user123')).toBe(true);
			expect(validateUsername('123user')).toBe(true);
		});

		it('アンダースコアを含むユーザー名を許可する', () => {
			expect(validateUsername('test_user')).toBe(true);
			expect(validateUsername('_test')).toBe(true);
			expect(validateUsername('test_')).toBe(true);
			expect(validateUsername('___')).toBe(true);
		});

		it('@プレフィックス付きユーザー名を許可する', () => {
			expect(validateUsername('@testuser')).toBe(true);
			expect(validateUsername('@user_123')).toBe(true);
		});

		it('大文字小文字混在のユーザー名を許可する', () => {
			expect(validateUsername('TestUser')).toBe(true);
			expect(validateUsername('TEST')).toBe(true);
			expect(validateUsername('TeSt_UsEr')).toBe(true);
		});

		it('1文字のユーザー名を許可する', () => {
			expect(validateUsername('a')).toBe(true);
			expect(validateUsername('1')).toBe(true);
			expect(validateUsername('_')).toBe(true);
		});

		it('15文字のユーザー名を許可する（上限）', () => {
			expect(validateUsername('123456789012345')).toBe(true); // 15文字
			expect(validateUsername('a_b_c_d_e_f_g_h')).toBe(true); // 15文字
		});
	});

	describe('無効なユーザー名', () => {
		it('16文字以上のユーザー名を拒否する', () => {
			expect(validateUsername('1234567890123456')).toBe(false); // 16文字
			expect(validateUsername('verylongusername123')).toBe(false);
		});

		it('ハイフンを含むユーザー名を拒否する', () => {
			expect(validateUsername('test-user')).toBe(false);
			expect(validateUsername('-test')).toBe(false);
		});

		it('ドットを含むユーザー名を拒否する', () => {
			expect(validateUsername('test.user')).toBe(false);
			expect(validateUsername('.test')).toBe(false);
		});

		it('スペースを含むユーザー名を拒否する', () => {
			expect(validateUsername('test user')).toBe(false);
			expect(validateUsername(' test')).toBe(false);
			expect(validateUsername('test ')).toBe(false);
		});

		it('特殊文字を含むユーザー名を拒否する', () => {
			expect(validateUsername('test@user')).toBe(false); // @ in middle
			expect(validateUsername('test!user')).toBe(false);
			expect(validateUsername('test#user')).toBe(false);
			expect(validateUsername('test$user')).toBe(false);
			expect(validateUsername('test%user')).toBe(false);
			expect(validateUsername('test&user')).toBe(false);
			expect(validateUsername('test*user')).toBe(false);
		});

		it('空文字列を拒否する', () => {
			expect(validateUsername('')).toBe(false);
		});

		it('@のみを拒否する', () => {
			expect(validateUsername('@')).toBe(false);
		});

		it('Unicode文字を含むユーザー名を拒否する', () => {
			expect(validateUsername('テスト')).toBe(false);
			expect(validateUsername('test日本語')).toBe(false);
			expect(validateUsername('😀')).toBe(false);
		});
	});

	describe('X仕様準拠テスト', () => {
		it('実際のXユーザー名パターンを検証する', () => {
			// 実在しそうなユーザー名パターン
			expect(validateUsername('elonmusk')).toBe(true);
			expect(validateUsername('Twitter')).toBe(true);
			expect(validateUsername('jack')).toBe(true);
			expect(validateUsername('X')).toBe(true);
		});

		it('XのURL形式で使用されるパターンを検証する', () => {
			// https://x.com/username 形式
			expect(validateUsername('test_user_123')).toBe(true);
			expect(validateUsername('_underscore')).toBe(true);
		});

		it('旧Twitter時代のユーザー名パターンを検証する', () => {
			expect(validateUsername('@twitter')).toBe(true);
			expect(validateUsername('verified')).toBe(true);
		});
	});

	describe('セキュリティとエッジケース', () => {
		it('SQLインジェクション試行を拒否する', () => {
			expect(validateUsername("admin'--")).toBe(false);
			expect(validateUsername("1' OR '1'='1")).toBe(false);
		});

		it('パストラバーサル試行を拒否する', () => {
			expect(validateUsername('../admin')).toBe(false);
			expect(validateUsername('../../etc')).toBe(false);
		});

		it('スクリプトインジェクション試行を拒否する', () => {
			expect(validateUsername('<script>')).toBe(false);
			expect(validateUsername('alert(1)')).toBe(false); // 括弧が無効
		});

		it('コマンドインジェクション試行を拒否する', () => {
			expect(validateUsername('test;rm -rf')).toBe(false);
			expect(validateUsername('test|cat /etc')).toBe(false);
		});

		it('制御文字を拒否する', () => {
			expect(validateUsername('test\nuser')).toBe(false);
			expect(validateUsername('test\tuser')).toBe(false);
			expect(validateUsername('test\ruser')).toBe(false);
		});
	});

	describe('@プレフィックス処理', () => {
		it('@ありとなしで同じユーザー名を検証する', () => {
			expect(validateUsername('testuser')).toBe(validateUsername('@testuser'));
			expect(validateUsername('user_123')).toBe(validateUsername('@user_123'));
		});

		it('@が途中にある場合は無効', () => {
			expect(validateUsername('test@user')).toBe(false);
			expect(validateUsername('@@testuser')).toBe(false);
		});
	});
});

describe('cleanUsername', () => {
	it('@プレフィックスを削除する', () => {
		expect(cleanUsername('@testuser')).toBe('testuser');
		expect(cleanUsername('@user_123')).toBe('user_123');
	});

	it('@がない場合はそのまま返す', () => {
		expect(cleanUsername('testuser')).toBe('testuser');
		expect(cleanUsername('user_123')).toBe('user_123');
	});

	it('空文字列を処理する', () => {
		expect(cleanUsername('')).toBe('');
	});

	it('@のみの場合は空文字列を返す', () => {
		expect(cleanUsername('@')).toBe('');
	});
});
