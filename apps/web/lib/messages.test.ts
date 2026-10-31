import type { MessageResponse } from "@chat-app/shared";
import { channelMessageFrom, mergeMessages, oldestMessageId } from "./messages";

const message = (id: number, body = `m${id}`): MessageResponse => ({
	id,
	kind: "text",
	body,
	sender: { id: "p1", name: "Owner" },
	createdAt: "2026-10-30T05:00:00.000Z",
});

describe("mergeMessages", () => {
	it("古い順に並べ、同じ id は 1 つにする（後から届いたほうを使う）", () => {
		const current = [message(2), message(3)];

		expect(
			mergeMessages(current, [message(5), message(3, "new"), message(1)]),
		).toEqual([message(1), message(2), message(3, "new"), message(5)]);
		// 元の配列は変えない
		expect(current).toEqual([message(2), message(3)]);
	});

	it("自分が送ったものが応答とイベントの両方で届いても、1 つだけになる", () => {
		const sent = message(10);
		expect(mergeMessages(mergeMessages([], [sent]), [sent])).toEqual([sent]);
	});
});

describe("oldestMessageId", () => {
	it("一番古いメッセージの id。無ければ undefined", () => {
		expect(oldestMessageId([message(3), message(7)])).toBe(3);
		expect(oldestMessageId([])).toBeUndefined();
	});
});

describe("channelMessageFrom", () => {
	const event = (roomId: string, type = "message.created") => ({
		type,
		room: { type: "channel" as const, id: roomId },
		data: message(1),
	});

	it("そのチャンネルの message.created だけを取り出す", () => {
		expect(channelMessageFrom(event("c1"), "c1")).toEqual(message(1));
		expect(channelMessageFrom(event("c2"), "c1")).toBeNull();
		expect(channelMessageFrom(event("c1", "other"), "c1")).toBeNull();
		expect(channelMessageFrom({ type: "ready" }, "c1")).toBeNull();
	});
});
