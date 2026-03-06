/**
 * 記号検索用データ
 * 検索キーワード（日本語・読み）で記号を検索できる
 */
export interface SymbolEntry {
	symbol: string;
	name: string;
	keywords: string[]; // 検索用キーワード（ひらがな・カタカナ・漢字など）
}

export const symbols: SymbolEntry[] = [
	// 等号・比較
	{ symbol: '=', name: '等号（イコール）', keywords: ['いこーる', 'イコール', '等号', 'とうごう'] },
	{
		symbol: '≠',
		name: '不等号（ノットイコール）',
		keywords: ['のっといこーる', 'ノットイコール', '不等号', 'ふとうごう', '等しくない']
	},
	{
		symbol: '≈',
		name: 'ほぼ等しい（ニアリイコール）',
		keywords: ['ニアリイコール', 'にありいこーる', 'ほぼ等しい', 'ほぼいこーる', '約等于']
	},
	{
		symbol: '≒',
		name: 'ほぼ等しい（日本式）',
		keywords: ['ニアリイコール', 'ほぼ等しい', 'にほんしき']
	},
	{ symbol: '≡', name: '合同', keywords: ['ごうどう', '合同', '恒等'] },
	{ symbol: '≦', name: '小なりイコール', keywords: ['しょうなりいこーる', '以下', 'いか'] },
	{ symbol: '≧', name: '大なりイコール', keywords: ['だいなりいこーる', '以上', 'いじょう'] },
	{ symbol: '≤', name: '以下', keywords: ['いか', '以下', 'しょうなりいこーる'] },
	{ symbol: '≥', name: '以上', keywords: ['いじょう', '以上', 'だいなりいこーる'] },
	{ symbol: '<', name: '小なり', keywords: ['しょうなり', '小なり', 'より小さい'] },
	{ symbol: '>', name: '大なり', keywords: ['だいなり', '大なり', 'より大きい'] },
	{ symbol: '≪', name: '非常に小さい', keywords: ['ひじょうにちいさい'] },
	{ symbol: '≫', name: '非常に大きい', keywords: ['ひじょうにおおきい'] },

	// 演算
	{ symbol: '+', name: 'プラス', keywords: ['ぷらす', 'プラス', '足す', 'たす'] },
	{ symbol: '−', name: 'マイナス（全角）', keywords: ['まいなす', 'マイナス', 'ひく', '引く'] },
	{ symbol: '-', name: 'ハイフン・マイナス', keywords: ['はいふん', 'まいなす', 'ひく'] },
	{ symbol: '±', name: 'プラスマイナス', keywords: ['ぷらすまいなす', 'プラスマイナス', '正負'] },
	{ symbol: '∓', name: 'マイナスプラス', keywords: ['まいなすぷらす'] },
	{ symbol: '×', name: 'かける', keywords: ['かける', '乗算', 'じょうざん', 'バツ'] },
	{ symbol: '÷', name: 'わる', keywords: ['わる', '除算', 'じょざん'] },
	{ symbol: '⋅', name: '中黒（乗算）', keywords: ['なかぐろ', '乗算', 'じょうざん'] },
	{ symbol: '∗', name: 'アスタリスク', keywords: ['あすたりすく', 'かける'] },
	{ symbol: '⁄', name: 'スラッシュ（分数）', keywords: ['すらっしゅ', '分数', 'ぶんすう'] },
	{ symbol: '√', name: 'ルート', keywords: ['るーと', 'ルート', '平方根', 'へいほうこん'] },
	{ symbol: '∛', name: '三乗根', keywords: ['さんじょうこん', '三乗根'] },
	{ symbol: '∞', name: '無限大', keywords: ['むげんだい', '無限大', '無限', 'むげん'] },
	{ symbol: '∑', name: 'シグマ（総和）', keywords: ['しぐま', 'シグマ', '総和', 'そうわ'] },
	{ symbol: '∏', name: 'パイ（総乗）', keywords: ['ぱい', '総乗', 'そうじょう'] },
	{ symbol: '∫', name: '積分', keywords: ['せきぶん', '積分'] },
	{ symbol: '∂', name: '偏微分', keywords: ['へんびぶん', '偏微分'] },
	{ symbol: '∇', name: 'ナブラ', keywords: ['なぶら', 'ナブラ', '勾配'] },
	{ symbol: 'π', name: 'パイ（円周率）', keywords: ['ぱい', 'パイ', '円周率', 'えんしゅうりつ'] },
	{ symbol: '°', name: '度', keywords: ['ど', '度', '角度'] },
	{ symbol: '′', name: '分（プライム）', keywords: ['ふん', 'ぷらいむ', '分'] },
	{ symbol: '″', name: '秒（ダブルプライム）', keywords: ['びょう', '秒'] },

	// 論理・集合
	{ symbol: '∧', name: 'かつ（論理積）', keywords: ['かつ', 'ろんりせき', 'AND'] },
	{ symbol: '∨', name: 'または（論理和）', keywords: ['または', 'ろんりわ', 'OR'] },
	{ symbol: '¬', name: '否定', keywords: ['ひてい', '否定', 'NOT'] },
	{ symbol: '∀', name: '全称', keywords: ['ぜんしょう', '全称', 'すべて'] },
	{ symbol: '∃', name: '存在', keywords: ['そんざい', '存在'] },
	{ symbol: '∈', name: '属する', keywords: ['ぞくする', '属する', '要素'] },
	{ symbol: '∉', name: '属さない', keywords: ['ぞくさない'] },
	{ symbol: '⊂', name: '部分集合', keywords: ['ぶぶんしゅうごう', '部分集合'] },
	{ symbol: '⊃', name: '含む', keywords: ['ふくむ', '含む'] },
	{ symbol: '∪', name: '和集合', keywords: ['わしゅうごう', '和集合'] },
	{ symbol: '∩', name: '積集合', keywords: ['せきしゅうごう', '積集合'] },
	{ symbol: '∅', name: '空集合', keywords: ['くうしゅうごう', '空集合'] },

	// 矢印
	{
		symbol: '→',
		name: '右矢印',
		keywords: ['みぎやじるし', '右矢印', 'やじるし', '矢印', 'うえき']
	},
	{ symbol: '←', name: '左矢印', keywords: ['ひだりやじるし', '左矢印', 'やじるし', '矢印'] },
	{ symbol: '↑', name: '上矢印', keywords: ['うえやじるし', '上矢印', 'やじるし', '矢印'] },
	{ symbol: '↓', name: '下矢印', keywords: ['したやじるし', '下矢印', 'やじるし', '矢印'] },
	{ symbol: '⇒', name: 'ならば（二重矢印）', keywords: ['ならば', '二重矢印', 'にじゅうやじるし'] },
	{ symbol: '⇔', name: '同値', keywords: ['どうち', '同値', '双方向'] },
	{ symbol: '⟹', name: 'ならば（長い）', keywords: ['ならば'] },
	{ symbol: '⟺', name: '同値（長い）', keywords: ['どうち'] },
	{ symbol: '↔', name: '双方向矢印', keywords: ['そうほうこう', '双方向'] },
	{ symbol: '↗', name: '右上矢印', keywords: ['みぎうえ', '右上'] },
	{ symbol: '↘', name: '右下矢印', keywords: ['みぎした', '右下'] },
	{ symbol: '↙', name: '左下矢印', keywords: ['ひだりした', '左下'] },
	{ symbol: '↖', name: '左上矢印', keywords: ['ひだりうえ', '左上'] },

	// 括弧・記号
	{ symbol: '「」', name: '鉤括弧', keywords: ['かぎかっこ', '鉤括弧', '引用'] },
	{ symbol: '『』', name: '二重鉤括弧', keywords: ['にじゅうかぎかっこ', '二重鉤括弧'] },
	{ symbol: '（）', name: '丸括弧', keywords: ['まるかっこ', '丸括弧', 'パーレン'] },
	{ symbol: '［］', name: '角括弧', keywords: ['かくかっこ', '角括弧', 'ブラケット'] },
	{ symbol: '｛｝', name: '波括弧', keywords: ['なみかっこ', '波括弧', 'ブレース'] },
	{ symbol: '〈〉', name: '山括弧', keywords: ['やまかっこ', '山括弧'] },
	{ symbol: '《》', name: '二重山括弧', keywords: ['にじゅうやまかっこ'] },
	{ symbol: '…', name: '三点リーダー', keywords: ['さんてんりーだー', '三点リーダー', '省略'] },
	{ symbol: '‥', name: '二点リーダー', keywords: ['にてんりーだー'] },
	{ symbol: '・', name: '中黒', keywords: ['なかぐろ', '中黒', '中点'] },
	{ symbol: '、', name: '読点', keywords: ['とうてん', '読点', 'てん'] },
	{ symbol: '。', name: '句点', keywords: ['くてん', '句点', 'まる'] },

	// 通貨・単位
	{ symbol: '¥', name: '円', keywords: ['えん', '円', '円マーク', '日本'] },
	{ symbol: '€', name: 'ユーロ', keywords: ['ゆーろ', 'ユーロ', 'ユーロマーク'] },
	{ symbol: '$', name: 'ドル', keywords: ['どる', 'ドル', 'ダラー'] },
	{ symbol: '£', name: 'ポンド', keywords: ['ぽんど', 'ポンド', 'イギリス'] },
	{ symbol: '¢', name: 'セント', keywords: ['せんと', 'セント'] },
	{ symbol: '℃', name: '摂氏', keywords: ['せっし', '摂氏', '度', '温度'] },
	{ symbol: '℉', name: '華氏', keywords: ['かし', '華氏'] },
	{ symbol: '％', name: 'パーセント', keywords: ['ぱーせんと', 'パーセント', '百分率'] },
	{ symbol: '‰', name: 'パーミル', keywords: ['ぱーみる', 'パーミル'] },

	// 著作権・商標
	{
		symbol: '©',
		name: 'コピーライト',
		keywords: ['こぴーらいと', 'コピーライト', '著作権', 'ちょさくけん', 'まるしー']
	},
	{ symbol: '®', name: '登録商標', keywords: ['とうろくしょうひょう', '登録商標', 'まるあーる'] },
	{
		symbol: '™',
		name: 'トレードマーク',
		keywords: ['とれーどまーく', 'トレードマーク', '商標', 'しょうひょう', 'まるてぃーえむ']
	},
	{ symbol: '§', name: 'セクション', keywords: ['せくしょん', 'セクション', '節'] },
	{ symbol: '¶', name: '段落記号', keywords: ['だんらく', '段落', 'ぴろっと'] },

	// その他
	{ symbol: '★', name: '星', keywords: ['ほし', '星', 'スター'] },
	{ symbol: '☆', name: '白抜き星', keywords: ['ほし', '星', 'しろぬき'] },
	{ symbol: '◆', name: '菱形', keywords: ['ひしがた', '菱形', 'ダイヤ'] },
	{ symbol: '◇', name: '白抜き菱形', keywords: ['ひしがた', '菱形'] },
	{ symbol: '●', name: '黒丸', keywords: ['くろまる', '黒丸', 'まる'] },
	{ symbol: '○', name: '白丸', keywords: ['しろまる', '白丸', 'まる'] },
	{ symbol: '■', name: '黒四角', keywords: ['くろしかく', '黒四角'] },
	{ symbol: '□', name: '白四角', keywords: ['しろしかく', '白四角'] },
	{ symbol: '▲', name: '上向き三角', keywords: ['さんかく', '三角', 'うえむき'] },
	{ symbol: '▼', name: '下向き三角', keywords: ['さんかく', '三角', 'したむき'] },
	{ symbol: '✓', name: 'チェックマーク', keywords: ['ちぇっく', 'チェック', 'レ', '正解'] },
	{ symbol: '✔', name: '太字チェック', keywords: ['ちぇっく', 'チェック'] },
	{ symbol: '✗', name: 'バツ', keywords: ['ばつ', 'バツ', '不正解'] },
	{ symbol: '✘', name: '太字バツ', keywords: ['ばつ', 'バツ'] },
	{ symbol: '※', name: '米印', keywords: ['こめじるし', '米印', '注釈'] },
	{ symbol: '〒', name: '郵便マーク', keywords: ['ゆうびん', '郵便', '郵便番号'] },
	{ symbol: '☎', name: '電話', keywords: ['でんわ', '電話', 'テレフォン'] },
	{ symbol: '✉', name: '封筒', keywords: ['ふうとう', '封筒', 'メール'] },
	{ symbol: '♀', name: '女性', keywords: ['じょせい', '女性', 'めす'] },
	{ symbol: '♂', name: '男性', keywords: ['だんせい', '男性', 'おす'] },
	{ symbol: '♠', name: 'スペード', keywords: ['すぺーど', 'スペード'] },
	{ symbol: '♥', name: 'ハート', keywords: ['はーと', 'ハート'] },
	{ symbol: '♦', name: 'ダイヤ', keywords: ['だいや', 'ダイヤ'] },
	{ symbol: '♣', name: 'クラブ', keywords: ['くらぶ', 'クラブ'] }
];
