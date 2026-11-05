import type { MessageResponse } from "@chat-app/shared";
import {
	applyLatestPage,
	channelMessageFrom,
	mergeMessages,
	oldestMessageId,
	shouldReplaceWithLatestPage,
} from "./messages";

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

describe("shouldReplaceWithLatestPage・applyLatestPage", () => {
	const page = (ids: number[], hasMore: boolean) => ({
		// API は新しい順
		messages: ids.map((id) => message(id)).reverse(),
		hasMore,
	});
	const range = (from: number, to: number) =>
		Array.from({ length: to - from + 1 }, (_, i) => from + i);

	it("つながっていれば、置き換えずに足す", () => {
		const latest = page([99, 100, 101, 102], true);

		expect(shouldReplaceWithLatestPage(latest, 100)).toBe(false);
		expect(
			applyLatestPage(
				[98, 99, 100].map((id) => message(id)),
				latest,
				false,
			),
		).toEqual([98, 99, 100, 101, 102].map((id) => message(id)));
	});

	it("間に読んでいないものがあれば、そのページで置き換える", () => {
		// 画面は 100 まで。切れている間に 101〜200 が届き、最新のページは 151〜200
		const latest = page(range(151, 200), true);

		expect(shouldReplaceWithLatestPage(latest, 100)).toBe(true);
		expect(
			applyLatestPage(
				[99, 100].map((id) => message(id)),
				latest,
				true,
			),
		).toEqual(range(151, 200).map((id) => message(id)));
	});

	it("読み直しの間に新しいものが届いても、始めた時点の id で抜けを見つけ、届いたものは残す", () => {
		const latest = page(range(151, 200), true);
		// 読み直しを始めた時点では 100 まで。応答の前に 201 が届いた
		const current = [99, 100, 201].map((id) => message(id));

		expect(shouldReplaceWithLatestPage(latest, 100)).toBe(true);
		expect(applyLatestPage(current, latest, true)).toEqual(
			[...range(151, 200), 201].map((id) => message(id)),
		);
	});

	it("画面が空だったときは、ページで置き換える（さらに古いものの有無もページに合わせる）", () => {
		expect(
			shouldReplaceWithLatestPage(page(range(51, 100), true), undefined),
		).toBe(true);
		expect(shouldReplaceWithLatestPage(page([], false), undefined)).toBe(true);
	});

	it("さらに古いものが無ければ、抜けは無いので置き換えない", () => {
		expect(shouldReplaceWithLatestPage(page([5, 6], false), 1)).toBe(false);
	});
});
