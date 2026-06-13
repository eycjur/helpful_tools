export interface BasicInfo {
	fileName: string;
	fileSize: number;
	mimeType: string;
	width: number;
	height: number;
	lastModified: string;
}

export interface MetadataSection {
	title: string;
	icon: string;
	data: Record<string, unknown>;
}

// C2PA アサーションラベルの日本語名マッピング（未知ラベルは生文字列フォールバック）
export const C2PA_ASSERTION_LABELS: Record<string, string> = {
	'c2pa.actions': 'アクション履歴',
	'c2pa.actions.v2': 'アクション履歴 v2',
	'c2pa.hash.data': 'データハッシュ',
	'c2pa.hash.boxes': 'ボックスハッシュ',
	'c2pa.hash.bmff': 'BMFFハッシュ',
	'c2pa.thumbnail.claim.jpeg': 'サムネイル（JPEG）',
	'c2pa.thumbnail.claim.png': 'サムネイル（PNG）',
	'c2pa.thumbnail.ingredient.jpeg': '素材サムネイル（JPEG）',
	'c2pa.thumbnail.ingredient.png': '素材サムネイル（PNG）',
	'c2pa.ingredient.v2': '素材情報 v2',
	'c2pa.ingredient.v3': '素材情報 v3',
	'c2pa.ingredient': '素材情報',
	'c2pa.icon': 'アイコン',
	'c2pa.certificate-status': '証明書ステータス',
	'c2pa.training-mining': 'AIトレーニング・マイニング',
	'c2pa.cloud-data': 'クラウドデータ',
	'c2pa.soft-binding': 'ソフトバインディング',
	'c2pa.endorsement': '保証情報',
	'c2pa.depthmap': '深度マップ',
	'stds.schema-org.CreativeWork': '著作物情報（Schema.org）',
	'stds.iptc.photo-metadata': 'IPTCフォトメタデータ'
};

// C2PA DigitalSourceType の表示名マッピング
export const DIGITAL_SOURCE_TYPE_LABELS: Record<string, string> = {
	'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia':
		'AI生成コンテンツ（学習済みモデル）',
	'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia': 'アルゴリズム生成コンテンツ',
	'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia':
		'AI生成を含む合成コンテンツ',
	'http://c2pa.org/digitalsourcetype/trainedAlgorithmicData': 'AI学習データ',
	'http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced': 'AI強化コンテンツ',
	'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture': 'デジタル撮影',
	'http://cv.iptc.org/newscodes/digitalsourcetype/digitalArt': 'デジタルアート',
	'http://cv.iptc.org/newscodes/digitalsourcetype/minorHumanEdits': '軽微な編集',
	'http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits': '人手による編集',
	'http://cv.iptc.org/newscodes/digitalsourcetype/composite': '合成コンテンツ',
	'http://cv.iptc.org/newscodes/digitalsourcetype/softwareImage': 'ソフトウェア生成画像'
};

// AI生成を示す DigitalSourceType URI
export const AI_SOURCE_TYPE_URIS = [
	'trainedAlgorithmicMedia',
	'algorithmicMedia',
	'compositeWithTrainedAlgorithmicMedia',
	'trainedAlgorithmicData',
	'algorithmicallyEnhanced'
] as const;

export interface C2paAction {
	action: string;
	digitalSourceType?: string;
	softwareAgent?: string | { name: string; version?: string | null };
	when?: string;
	/** アクションの説明文（例: "Created by Google Generative AI."） */
	description?: string;
}

/** マニフェストチェーン内の1エントリ（アクティブ or 素材の祖先） */
export interface C2paManifestEntry {
	label: string;
	isActive: boolean;
	claimGeneratorInfo?: Array<{ name: string; version?: string | null }>;
	actions: C2paAction[];
	assertionLabels: string[];
	signatureIssuer?: string;
	signatureCommonName?: string;
	signatureTime?: string;
	isAiGenerated: boolean;
	/** このマニフェスト内のAI関連 digitalSourceType */
	aiSourceType?: string;
	aiSourceTypeLabel?: string;
}

export interface C2paProvenance {
	hasManifest: boolean;
	/** チェーン全体のいずれかのマニフェストでAI生成が検出された */
	isAiGenerated: boolean;
	claimGenerator?: string;
	claimGeneratorInfo?: Array<{ name: string; version?: string | null }>;
	digitalSourceType?: string;
	digitalSourceTypeLabel?: string;
	actions?: C2paAction[];
	assertionLabels?: string[];
	validationState?: string;
	title?: string;
	signatureIssuer?: string;
	signatureTime?: string;
	/** アクティブ → 祖先 の順に並んだマニフェストチェーン */
	manifestChain?: C2paManifestEntry[];
}
