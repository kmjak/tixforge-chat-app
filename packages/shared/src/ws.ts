/** WebSocket の接続の口（docs/context/ws.md）。server の origin につなぐ */
export const WS_PATH = "/api/ws";

/**
 * セッションが無効になって server が接続を閉じるときのコード（サインアウト・セッションの失効）。
 * ブラウザはこのコードで閉じられたら再接続しない
 */
export const WS_CLOSE_SESSION_ENDED = 4001;

/** イベントの届け先の「部屋」。今はチャンネルだけ（DM・グループ DM は後のチケットで種類を足す） */
export type WsRoom = { type: "channel"; id: string };

/** 接続できたときに server が最初に送るイベント */
export type WsReadyEvent = { type: "ready" };

/** 部屋に送るイベント。type ごとの data の形は、イベントを足すチケットで決める */
export type WsRoomEvent = { type: string; room: WsRoom; data: unknown };

/** server からブラウザに届くイベント（JSON の文字列で送る） */
export type WsServerEvent = WsReadyEvent | WsRoomEvent;

/** 届いた文字列をイベントとして読む。形が違えば null */
export function parseWsServerEvent(text: string): WsServerEvent | null {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const { type, room } = value as Record<string, unknown>;
	if (typeof type !== "string") {
		return null;
	}
	if (type === "ready") {
		return { type: "ready" };
	}
	if (
		typeof room !== "object" ||
		room === null ||
		(room as Record<string, unknown>).type !== "channel" ||
		typeof (room as Record<string, unknown>).id !== "string"
	) {
		return null;
	}
	return value as WsRoomEvent;
}
