import {
	parseWsServerEvent,
	WS_CLOSE_SESSION_ENDED,
	WS_PATH,
	type WsServerEvent,
} from "@chat-app/shared";

/**
 * 接続の状態。connecting：最初の接続中、open：つながっている、
 * reconnecting：切れて再接続を待っている、ended：セッションが無効で止めた（再接続しない）
 */
export type RealtimeStatus = "connecting" | "open" | "reconnecting" | "ended";

/** ブラウザの WebSocket のうち、使う部分（テストで偽物に差し替える） */
export type SocketLike = {
	onopen: (() => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: { code: number }) => void) | null;
	close: () => void;
};

/** 再接続までの待ち時間の最初と最大 */
export const RECONNECT_MIN_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

/** server の URL（http・https）から、WebSocket の接続先（ws・wss）を作る */
export function realtimeUrl(serverUrl: string): string {
	const url = new URL(WS_PATH, serverUrl);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}

/**
 * server と 1 本の WebSocket をつなぎ続ける（docs/context/ws.md）。切れたら、待ち時間を 1 秒から
 * 倍にして（30 秒まで）再接続する。WS_CLOSE_SESSION_ENDED で閉じられたら再接続せず onSessionEnded を呼ぶ
 */
export function createRealtimeClient({
	url,
	onStatus,
	onEvent,
	onSessionEnded,
	createSocket = (to) => new WebSocket(to) as unknown as SocketLike,
	setTimer = (callback, ms) => setTimeout(callback, ms),
	clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: {
	url: string;
	onStatus: (status: RealtimeStatus) => void;
	onEvent: (event: WsServerEvent) => void;
	onSessionEnded: () => void;
	createSocket?: (url: string) => SocketLike;
	setTimer?: (callback: () => void, ms: number) => unknown;
	clearTimer?: (timer: unknown) => void;
}): { start: () => void; stop: () => void } {
	let socket: SocketLike | null = null;
	let timer: unknown = null;
	let delay = RECONNECT_MIN_MS;
	let stopped = true;

	function open() {
		timer = null;
		const current = createSocket(url);
		socket = current;
		current.onopen = () => {
			delay = RECONNECT_MIN_MS;
			onStatus("open");
		};
		current.onmessage = (message) => {
			const event =
				typeof message.data === "string"
					? parseWsServerEvent(message.data)
					: null;
			if (event) {
				onEvent(event);
			}
		};
		current.onclose = ({ code }) => {
			if (stopped || socket !== current) {
				return;
			}
			socket = null;
			if (code === WS_CLOSE_SESSION_ENDED) {
				stopped = true;
				onStatus("ended");
				onSessionEnded();
				return;
			}
			onStatus("reconnecting");
			timer = setTimer(open, delay);
			delay = Math.min(delay * 2, RECONNECT_MAX_MS);
		};
	}

	return {
		start: () => {
			if (!stopped) {
				return;
			}
			stopped = false;
			delay = RECONNECT_MIN_MS;
			onStatus("connecting");
			open();
		},
		stop: () => {
			stopped = true;
			if (timer !== null) {
				clearTimer(timer);
				timer = null;
			}
			socket?.close();
			socket = null;
		},
	};
}
