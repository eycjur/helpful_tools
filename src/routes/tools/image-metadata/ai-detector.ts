import type { C2paSdk, ManifestStore, Manifest } from '@contentauth/c2pa-web';
import {
	AI_SOURCE_TYPE_URIS,
	DIGITAL_SOURCE_TYPE_LABELS,
	type C2paAction,
	type C2paManifestEntry,
	type C2paProvenance
} from './types';

// シングルトン: ファイルをドロップするたびにWebWorker+WASMを再生成しない
let sdkPromise: Promise<C2paSdk> | null = null;

function getSdk(): Promise<C2paSdk> {
	if (!sdkPromise) {
		const wasmSrc =
			'https://unpkg.com/@contentauth/c2pa-web@0.9.0/dist/resources/c2pa_bg.wasm';
		console.debug('[C2PA] SDK初期化開始 wasmSrc=', wasmSrc);
		sdkPromise = import('@contentauth/c2pa-web')
			.then(({ createC2pa }) => createC2pa({ wasmSrc }))
			.then((sdk) => {
				console.debug('[C2PA] SDK初期化完了', sdk);
				return sdk;
			})
			.catch((err) => {
				console.error('[C2PA] SDK初期化失敗', err);
				sdkPromise = null;
				throw err;
			});
	}
	return sdkPromise;
}

function isAiSourceType(uri: string): boolean {
	return AI_SOURCE_TYPE_URIS.some((key) => uri.includes(key));
}

/** マニフェスト1件から C2paManifestEntry を構築 */
function buildManifestEntry(
	manifest: Manifest,
	label: string,
	isActive: boolean
): C2paManifestEntry {
	// c2pa.actions / c2pa.actions.v2 など バージョンサフィックスがあるため startsWith で比較
	const assertions = manifest.assertions ?? [];
	const assertionLabels = assertions.map((a) => a.label);
	const actions: C2paAction[] = [];
	let aiSourceType: string | undefined;

	for (const a of assertions) {
		if (a.label.startsWith('c2pa.actions')) {
			const data = a.data as { actions?: C2paAction[] } | undefined;
			for (const action of data?.actions ?? []) {
				actions.push(action);
				if (action.digitalSourceType && !aiSourceType && isAiSourceType(action.digitalSourceType)) {
					aiSourceType = action.digitalSourceType;
				}
			}
		}
	}

	const aiSourceTypeLabel = aiSourceType
		? (DIGITAL_SOURCE_TYPE_LABELS[aiSourceType] ?? aiSourceType)
		: undefined;

	const sigInfo = manifest.signature_info;

	return {
		label,
		isActive,
		claimGeneratorInfo: manifest.claim_generator_info?.map((info) => ({
			name: info.name,
			version: info.version
		})),
		actions,
		assertionLabels,
		signatureIssuer: sigInfo?.issuer ?? undefined,
		signatureCommonName: sigInfo?.common_name ?? undefined,
		signatureTime: sigInfo?.time ?? undefined,
		isAiGenerated: !!aiSourceType,
		aiSourceType,
		aiSourceTypeLabel
	};
}

/**
 * C2PA来歴情報を読み取る。全マニフェスト（チェーン）を解析。
 * エラー時はスローする（呼び出し元でユーザーに表示すること）。
 */
export async function loadC2paProvenance(file: File | Blob): Promise<C2paProvenance> {
	const c2pa = await getSdk();

	const mimeType = file instanceof File ? file.type : 'image/jpeg';
	const fileName = file instanceof File ? file.name : '(blob)';
	console.debug(`[C2PA] fromBlob 開始 mimeType=${mimeType} file=${fileName}`);

	const reader = await c2pa.reader.fromBlob(mimeType, file);
	console.debug('[C2PA] fromBlob 結果', reader);

	if (!reader) {
		console.debug('[C2PA] マニフェストなし（reader=null）');
		return { hasManifest: false, isAiGenerated: false };
	}

	let store: ManifestStore;
	try {
		store = await reader.manifestStore();
		console.debug('[C2PA] manifestStore 生データ', JSON.stringify(store, null, 2));
	} finally {
		await reader.free();
	}

	const activeLabel = store.active_manifest ?? null;
	console.debug(`[C2PA] active_manifest=${activeLabel}`);

	if (!store.manifests || Object.keys(store.manifests).length === 0) {
		return {
			hasManifest: true,
			isAiGenerated: false,
			validationState: store.validation_state ?? undefined
		};
	}

	// アクティブマニフェストを先頭に、残りをラベル順で並べる
	const manifestChain: C2paManifestEntry[] = [];
	if (activeLabel && store.manifests[activeLabel]) {
		manifestChain.push(buildManifestEntry(store.manifests[activeLabel], activeLabel, true));
	}
	for (const [label, manifest] of Object.entries(store.manifests)) {
		if (label !== activeLabel) {
			manifestChain.push(buildManifestEntry(manifest, label, false));
		}
	}

	console.debug('[C2PA] manifestChain', manifestChain);

	// チェーン全体でAI生成判定
	const isAiGenerated = manifestChain.some((m) => m.isAiGenerated);

	// アクティブマニフェストの情報を後方互換的にトップレベルにも保持
	const active = manifestChain.find((m) => m.isActive) ?? manifestChain[0];
	const activeManifest = activeLabel ? store.manifests[activeLabel] : null;

	const result: C2paProvenance = {
		hasManifest: true,
		isAiGenerated,
		claimGenerator: activeManifest?.claim_generator ?? undefined,
		claimGeneratorInfo: active?.claimGeneratorInfo,
		digitalSourceType: active?.aiSourceType,
		digitalSourceTypeLabel: active?.aiSourceTypeLabel,
		actions: active?.actions,
		assertionLabels: active?.assertionLabels,
		validationState: store.validation_state ?? undefined,
		title: activeManifest?.title ?? undefined,
		signatureIssuer: active?.signatureIssuer,
		signatureTime: active?.signatureTime,
		manifestChain
	};

	console.debug('[C2PA] 解析結果', result);
	return result;
}

export function getActionLabel(action: string): string {
	const labels: Record<string, string> = {
		'c2pa.created': '作成',
		'c2pa.opened': '開く',
		'c2pa.edited': '編集',
		'c2pa.published': '公開',
		'c2pa.redacted': '削除・編集',
		'c2pa.converted': '変換',
		'c2pa.filtered': 'フィルター適用',
		'c2pa.color_adjustments': '色調整',
		'c2pa.resized': 'リサイズ',
		'c2pa.cropped': 'クロップ',
		'c2pa.combined': '合成',
		'c2pa.drawing': '描画',
		'c2pa.deleted': '削除',
		'c2pa.transcript': 'テキスト化',
		'c2pa.translated': '翻訳',
		'c2pa.repackaged': '再パッケージ',
		'c2pa.placed': '配置',
		'c2pa.watermarked': 'ウォーターマーク',
		'c2pa.watermarked.bound': 'ウォーターマーク（バウンド）',
		'c2pa.watermarked.unbound': 'ウォーターマーク（非バウンド）',
		'c2pa.generatedContent': 'コンテンツ生成',
		'c2pa.unknown': '不明'
	};
	// 完全一致を優先、なければドット区切りの最長プレフィックスで検索
	if (labels[action]) return labels[action];
	const parts = action.split('.');
	for (let i = parts.length - 1; i > 0; i--) {
		const prefix = parts.slice(0, i).join('.');
		if (labels[prefix]) return `${labels[prefix]}（${parts.slice(i).join('.')}）`;
	}
	return action;
}

/** softwareAgent（string または object）を表示文字列に変換 */
export function formatSoftwareAgent(
	agent: string | { name: string; version?: string | null } | undefined | null
): string | null {
	if (!agent) return null;
	if (typeof agent === 'string') return agent;
	return agent.version ? `${agent.name} ${agent.version}` : agent.name;
}
