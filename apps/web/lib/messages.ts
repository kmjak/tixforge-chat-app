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
 * 読み直した最新のページ（新しい順）で、画面を置き換えるか（再接続したとき・画面を開いたとき）。
 * knownNewestId は、読み直しを始めた時点で画面にあった一番新しい id（無ければ undefined）。
 * 間に読んでいないものがある（ページの一番古いものが knownNewestId より新しく、さらに古いものがある）か、
 * 画面が空だったときは置き換える（抜けたまま並ばないように。置き換えた後はさかのぼりで読み直せる）。
 * 読み直しの間に WebSocket で届いたものに左右されないよう、今の画面ではなく始めた時点の id で決める
 */
export function shouldReplaceWithLatestPage(
	page: MessagesResponse,
	knownNewestId: number | undefined,
): boolean {
	if (knownNewestId === undefined) {
		return true;
	}
	const oldestInPage = page.messages.at(-1)?.id;
	return (
		page.hasMore && oldestInPage !== undefined && oldestInPage > knownNewestId
	);
}

/**
 * 読み直した最新のページを、今の画面のメッセージに反映した結果。置き換えるときも、ページより新しいもの
 * （読み直しの間に WebSocket で届いた・送った）は残す
 */
export function applyLatestPage(
	current: MessageResponse[],
	page: MessagesResponse,
	replace: boolean,
): MessageResponse[] {
	if (!replace) {
		return mergeMessages(current, page.messages);
	}
	const newestInPage = page.messages[0]?.id;
	return mergeMessages(
		page.messages,
		newestInPage === undefined
			? current
			: current.filter((message) => message.id > newestInPage),
	);
}
