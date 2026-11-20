/**
 * 圧縮レベル（画質を維持・弱・中・強・最大）の定義。各レベルは「付加データの削除」と「画像の再圧縮」の設定一式で、
 * カスタムでは選んでいたレベルの設定を初期値として項目ごとに変更できる
 */
import type { OptimizeOptions } from './pdf-optimizer';
import type { ImageRecompressOptions } from './image-recompress';

export type CompressSettings = Required<OptimizeOptions> & {
	/** null なら画像は再圧縮しない（画質を変えない） */
	images: ImageRecompressOptions | null;
};

export type LevelKey = 'lossless' | 'low' | 'medium' | 'high' | 'max';

type Level = { label: string; note: string; settings: CompressSettings };

const BASE_EXTRAS = {
	removeThumbnails: true,
	removePieceInfo: true,
	removeMetadata: false,
	removeAttachments: false,
	subsetFonts: true
};

export const LEVELS: Record<LevelKey, Level> = {
	lossless: {
		label: '画質を維持',
		note: '画像はそのまま。重複・不要データの削除とデータの再圧縮のみ',
		settings: { ...BASE_EXTRAS, images: null }
	},
	low: {
		label: '弱',
		note: '300 ppi・品質0.85。印刷する資料向け',
		settings: {
			...BASE_EXTRAS,
			images: { maxPpi: 300, quality: 0.85, jpegGray: false, jpegFewColors: false }
		}
	},
	medium: {
		label: '中（推奨）',
		note: '150 ppi・品質0.6。グレースケール画像もJPEG化。画面で見る資料・メール添付向け',
		settings: {
			...BASE_EXTRAS,
			images: { maxPpi: 150, quality: 0.6, jpegGray: true, jpegFewColors: false }
		}
	},
	high: {
		label: '強',
		note: '72 ppi・品質0.4。図やスクリーンショットもJPEG化し、XMPメタデータも削除。画質より容量を優先',
		settings: {
			...BASE_EXTRAS,
			removeMetadata: true,
			images: { maxPpi: 72, quality: 0.4, jpegGray: true, jpegFewColors: true }
		}
	},
	max: {
		label: '最大',
		note: '50 ppi・品質0.3。とにかく小さくしたい場合。画像は粗くなり、添付ファイルとXMPメタデータも削除',
		settings: {
			...BASE_EXTRAS,
			removeMetadata: true,
			removeAttachments: true,
			images: { maxPpi: 50, quality: 0.3, jpegGray: true, jpegFewColors: true }
		}
	}
};

export const LEVEL_KEYS = Object.keys(LEVELS) as LevelKey[];

/** カスタムで編集する項目。画像の設定は「画質を維持」を選んでも値を保持し、戻したときに復元する */
export type CustomSettings = {
	extras: Required<OptimizeOptions>;
	recompressImages: boolean;
	images: ImageRecompressOptions;
};

/** カスタムで画像の再圧縮を有効にしたときの初期値 */
const DEFAULT_IMAGE_SETTINGS: ImageRecompressOptions = LEVELS.medium.settings.images!;

/** レベルの設定を、カスタムで編集できる独立したコピーにする */
export function customFrom(level: LevelKey): CustomSettings {
	const { images, ...extras } = LEVELS[level].settings;
	return {
		extras: { ...extras },
		recompressImages: images !== null,
		images: { ...(images ?? DEFAULT_IMAGE_SETTINGS) }
	};
}

/** 選択中のレベル（またはカスタム）から、圧縮処理に渡す設定を組み立てる */
export function resolveSettings(
	level: LevelKey | 'custom',
	custom: CustomSettings
): CompressSettings {
	if (level !== 'custom') return LEVELS[level].settings;
	return {
		...custom.extras,
		// <select> の値は文字列になりうるため数値に揃える
		images: custom.recompressImages
			? {
					...custom.images,
					quality: Number(custom.images.quality),
					maxPpi: custom.images.maxPpi === null ? null : Number(custom.images.maxPpi)
				}
			: null
	};
}
