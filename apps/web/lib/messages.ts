import type {
	MessageResponse,
	MessagesResponse,
	WsRoomEvent,
	WsServerEvent,
} from "@chat-app/shared";

/**
 * 画面のメッセージに、新しく受け取ったものを足す。古い順（id の小さい順）に並べ、同じ id は 1 つにする
 * （自分が送ったものは、API の応答と WebSocket のイベントの両方で届くため）。後から届いたほうを使う
 */
export function mergeMessages(
	current: MessageResponse[],
	incoming: MessageResponse[],
): MessageResponse[] {
	const byId = new Map(current.map((message) => [message.id, message]));
	for (const message of incoming) {
		byId.set(message.id, message);
	}
	return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** さかのぼるときに before に渡す id（画面にある中で一番古いもの）。無ければ undefined */
export function oldestMessageId(
	messages: MessageResponse[],
): number | undefined {
	return messages[0]?.id;
}

/** そのチャンネルの message.created のイベントなら、メッセージを返す */
export function channelMessageFrom(
	event: WsServerEvent,
	channelId: string,
): MessageResponse | null {
	if (event.type !== "message.created" || !("room" in event)) {
		return null;
	}
	const { room, data } = event as WsRoomEvent;
	if (room.type !== "channel" || room.id !== channelId) {
		return null;
	}
	return data as MessageResponse;
}

/**
 * 読み直した最新のページ（新しい順）を、画面のメッセージに反映する（再接続したとき・画面を開いたとき）。
 * ページの一番古いものが画面の一番新しいものより新しく、さらに古いものがある（＝間に読んでいないものが
 * ある）ときは、抜けたまま並ばないよう、画面をそのページで置き換える（replaced。さかのぼりで読み直せる）。
 * つながっていれば足すだけ
 */
export function applyLatestPage(
	current: MessageResponse[],
	page: MessagesResponse,
): { messages: MessageResponse[]; replaced: boolean } {
	const newestShown = current.at(-1)?.id;
	const oldestInPage = page.messages.at(-1)?.id;
	const gap =
		page.hasMore &&
		newestShown !== undefined &&
		oldestInPage !== undefined &&
		oldestInPage > newestShown;
	return gap
		? { messages: mergeMessages([], page.messages), replaced: true }
		: { messages: mergeMessages(current, page.messages), replaced: false };
}
