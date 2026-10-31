import {
	WS_CLOSE_SESSION_ENDED,
	type WsRoom,
	type WsServerEvent,
} from "@chat-app/shared";
import type { WSContext } from "hono/ws";
import { WebSocketServer } from "ws";

/**
 * ブラウザから受け取るメッセージの上限（バイト）。ブラウザからの送信は使わないので小さくし、
 * 大きなフレームでメモリを使わせないようにする（超えると ws が接続を閉じる）
 */
export const WS_MAX_PAYLOAD = 4096;

/** serve の websocket に渡す WebSocket の server（upgrade は serve が受ける） */
export function createWebSocketServer(): WebSocketServer {
	return new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });
}

/** 生存確認（ping）とセッションの確かめ直しの間隔 */
export const PING_INTERVAL_MS = 30_000;

/** ws の WebSocket のうち、生存確認で使う機能（WSContext.raw の中身） */
type RawSocket = {
	ping(): void;
	terminate(): void;
	on(event: "pong", listener: () => void): unknown;
};

/** 接続した人。headers は、セッションを確かめ直すための cookie */
export type RealtimeConnection = {
	userId: string;
	sessionId: string;
	headers: Headers;
	ws: WSContext;
};

export type RealtimeHub = {
	/** 接続を登録し、ready を送る */
	connect: (connection: RealtimeConnection) => void;
	/** 閉じた接続を外す */
	disconnect: (ws: WSContext) => void;
	/** 部屋の今の参加者の接続すべてに、イベントを送る */
	publish: (room: WsRoom, event: WsServerEvent) => Promise<void>;
	/** 生存確認：pong の返らない接続を切り、ping を送り、セッションが無効な接続を閉じる */
	checkConnections: () => Promise<void>;
	/**
	 * アカウントの接続のセッションを、その場で確かめ直す（セッションの失効・パスワードの変更などの後）。
	 * 無効なセッションの接続は WS_CLOSE_SESSION_ENDED で閉じる
	 */
	revalidateUser: (userId: string) => Promise<void>;
	/** 今の接続の数（テストで、閉じた接続が外れたかを確かめる） */
	connectionCount: () => number;
	/** checkConnections を PING_INTERVAL_MS ごとに動かす */
	start: () => void;
	stop: () => void;
};

type Entry = RealtimeConnection & { alive: boolean };

/**
 * WebSocket の配信の仕組み（docs/context/ws.md）。接続はアカウントごとに持ち、届け先は送るたびに
 * listRoomMemberIds で決める（購読の一覧を持たないので、参加・退出・チャンネルの作成・削除が
 * すぐに反映される）。server が 1 台の前提で、接続はメモリに持つ
 */
export function createRealtimeHub({
	listRoomMemberIds,
	getSession,
	pingIntervalMs = PING_INTERVAL_MS,
}: {
	listRoomMemberIds: (room: WsRoom) => Promise<string[]>;
	getSession: (headers: Headers) => Promise<{ sessionId: string } | null>;
	pingIntervalMs?: number;
}): RealtimeHub {
	const entries = new Map<WSContext, Entry>();
	let timer: ReturnType<typeof setInterval> | undefined;

	function send(entry: Entry, event: WsServerEvent) {
		// 1 = OPEN。閉じかけの接続には送らない
		if (entry.ws.readyState === 1) {
			entry.ws.send(JSON.stringify(event));
		}
	}

	function endSession(entry: Entry) {
		entries.delete(entry.ws);
		entry.ws.close(WS_CLOSE_SESSION_ENDED, "session ended");
	}

	/**
	 * 接続のセッションがまだ有効かを確かめ、無効なら閉じる。同じセッションは 1 回だけ、並べて確かめる。
	 * 確かめるのに失敗したセッション（DB の一時的な失敗など）は、その回は閉じない
	 */
	async function revalidate(targets: Entry[]) {
		const sessions = new Map<string, Headers>();
		for (const entry of targets) {
			sessions.set(entry.sessionId, entry.headers);
		}
		const ended = new Set<string>();
		await Promise.all(
			[...sessions].map(async ([sessionId, headers]) => {
				try {
					const session = await getSession(headers);
					if (session?.sessionId !== sessionId) {
						ended.add(sessionId);
					}
				} catch (error) {
					console.error(
						"WebSocket のセッションを確かめられませんでした",
						error,
					);
				}
			}),
		);
		for (const entry of targets) {
			if (ended.has(entry.sessionId) && entries.has(entry.ws)) {
				endSession(entry);
			}
		}
	}

	const hub: RealtimeHub = {
		connect: (connection) => {
			const entry: Entry = { ...connection, alive: true };
			entries.set(connection.ws, entry);
			(connection.ws.raw as RawSocket | undefined)?.on("pong", () => {
				entry.alive = true;
			});
			send(entry, { type: "ready" });
		},

		disconnect: (ws) => {
			entries.delete(ws);
		},

		publish: async (room, event) => {
			const memberIds = new Set(await listRoomMemberIds(room));
			for (const entry of entries.values()) {
				if (memberIds.has(entry.userId)) {
					send(entry, event);
				}
			}
		},

		checkConnections: async () => {
			const checking: Entry[] = [];
			for (const entry of [...entries.values()]) {
				const raw = entry.ws.raw as RawSocket | undefined;
				if (!entry.alive) {
					// 前回の ping に pong が返っていない（回線が切れた・ブラウザが落ちた）
					entries.delete(entry.ws);
					raw?.terminate();
					continue;
				}
				entry.alive = false;
				raw?.ping();
				checking.push(entry);
			}
			await revalidate(checking);
		},

		revalidateUser: (userId) =>
			revalidate(
				[...entries.values()].filter((entry) => entry.userId === userId),
			),

		connectionCount: () => entries.size,

		start: () => {
			timer ??= setInterval(() => {
				hub.checkConnections().catch((error: unknown) => {
					console.error("WebSocket の生存確認に失敗しました", error);
				});
			}, pingIntervalMs);
			timer.unref();
		},

		stop: () => {
			clearInterval(timer);
			timer = undefined;
		},
	};
	return hub;
}
