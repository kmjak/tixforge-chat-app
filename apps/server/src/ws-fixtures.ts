// テストだけで使う補助関数。WebSocket で接続し、届いたイベントを待つ
import type { WsServerEvent } from "@chat-app/shared";
import WebSocket from "ws";
import { WEB_ORIGIN } from "./test-helpers";

export type WsClient = {
	ws: WebSocket;
	events: WsServerEvent[];
	/** 条件に合うイベントが届くまで待つ（届いていればすぐ返す） */
	waitFor: (match: (event: WsServerEvent) => boolean) => Promise<WsServerEvent>;
};

/** cookie を付けて接続し、ready が届くまで待つ。closeAll で全部閉じる */
export function createWsClients(url: () => string) {
	const opened: WebSocket[] = [];

	async function connect(cookie: string): Promise<WsClient> {
		const ws = new WebSocket(url(), {
			headers: { Cookie: cookie },
			origin: WEB_ORIGIN,
		});
		opened.push(ws);
		const events: WsServerEvent[] = [];
		const waiters: {
			match: (event: WsServerEvent) => boolean;
			resolve: (event: WsServerEvent) => void;
		}[] = [];
		ws.on("message", (data) => {
			const event = JSON.parse(String(data)) as WsServerEvent;
			events.push(event);
			for (const waiter of waiters.filter((w) => w.match(event))) {
				waiters.splice(waiters.indexOf(waiter), 1);
				waiter.resolve(event);
			}
		});
		const waitFor: WsClient["waitFor"] = (match) =>
			new Promise((resolve) => {
				const found = events.find(match);
				if (found) {
					resolve(found);
					return;
				}
				waiters.push({ match, resolve });
			});
		await waitFor((event) => event.type === "ready");
		return { ws, events, waitFor };
	}

	function closeAll() {
		for (const ws of opened.splice(0)) {
			ws.terminate();
		}
	}

	return { connect, closeAll };
}
