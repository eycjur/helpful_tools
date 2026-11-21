import { findMatches } from './matches';

export type MatchRequest = { pattern: string; flags: string; input: string };

export type MatchResponse = { matches: ReturnType<typeof findMatches> } | { error: string };
export type MatchWorkerMessage = { started: true } | MatchResponse;

self.onmessage = (event: MessageEvent<MatchRequest>) => {
	const { pattern, flags, input } = event.data;
	self.postMessage({ started: true } satisfies MatchWorkerMessage, { transfer: [] });
	let response: MatchResponse;

	try {
		response = { matches: findMatches(new RegExp(pattern, flags), input) };
	} catch (error) {
		response = { error: error instanceof Error ? error.message : String(error) };
	}

	self.postMessage(response, { transfer: [] });
};
