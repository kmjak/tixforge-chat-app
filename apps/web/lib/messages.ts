import type {
	MessageResponse,
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
