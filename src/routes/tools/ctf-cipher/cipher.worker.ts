import { decryptText } from './cipher-tools';
import type { DecryptResponse } from './types';

const scope = self as unknown as {
	onmessage: (event: MessageEvent<string>) => void;
	postMessage(message: DecryptResponse): void;
};

scope.onmessage = ({ data }) => {
	try {
		scope.postMessage({ groups: decryptText(data) });
	} catch (err) {
		scope.postMessage({ error: err instanceof Error ? err.message : '解読に失敗しました' });
	}
};
