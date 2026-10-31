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
 * ブラウザの cookie で GET /api/auth/get-session を呼び、セッションが有効かを返す。
 * server に届かない・想定外の応答なら、分からないので null
 */
export async function checkBrowserSession(
	serverUrl: string,
	fetchFn: typeof fetch = fetch,
): Promise<boolean | null> {
	try {
		const res = await fetchFn(`${serverUrl}/api/auth/get-session`, {
			credentials: "include",
			cache: "no-store",
		});
		if (!res.ok) {
			return null;
		}
		const body: unknown = await res.json();
		return typeof body === "object" && body !== null && "session" in body;
	} catch {
		return null;
	}
}

/**
 * server と 1 本の WebSocket をつなぎ続ける（docs/context/ws.md）。切れたら、待ち時間を 1 秒から
 * 倍にして（30 秒まで）再接続する。WS_CLOSE_SESSION_ENDED で閉じられたら再接続せず onSessionEnded を呼ぶ。
 * つながらずに閉じたとき（未ログインの 401 も、ブラウザには区別できずにこう見える）は、checkSession で
 * セッションを確かめ、無効なら同じく止める。分からない（server に届かない）なら再接続を続ける
 */
export function createRealtimeClient({
	url,
	onStatus,
	onEvent,
	onSessionEnded,
	checkSession,
	createSocket = (to) => new WebSocket(to) as unknown as SocketLike,
	setTimer = (callback, ms) => setTimeout(callback, ms),
	clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: {
	url: string;
	onStatus: (status: RealtimeStatus) => void;
	onEvent: (event: WsServerEvent) => void;
	onSessionEnded: () => void;
	checkSession: () => Promise<boolean | null>;
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
		let opened = false;
		current.onopen = () => {
			opened = true;
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
				end();
				return;
			}
			onStatus("reconnecting");
			if (opened) {
				scheduleReconnect();
				return;
			}
			// つながらずに閉じた：セッションが無効になっていないか確かめてから再接続する
			void checkSession().then((valid) => {
				if (stopped || socket !== null || timer !== null) {
					return;
				}
				if (valid === false) {
					end();
					return;
				}
				scheduleReconnect();
			});
		};
	}

	function scheduleReconnect() {
		timer = setTimer(open, delay);
		delay = Math.min(delay * 2, RECONNECT_MAX_MS);
	}

	function end() {
		stopped = true;
		onStatus("ended");
		onSessionEnded();
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
