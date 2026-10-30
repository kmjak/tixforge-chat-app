import type { ChannelResponse } from "@chat-app/shared";
import {
	type ChannelLayout,
	findOverLimit,
	moveCategory,
	moveChannel,
	moveChannelTo,
	sameOrder,
	toLayoutRequest,
} from "./channel-layout";

const ch = (id: string, isDefault = false): ChannelResponse => ({
	id,
	name: id,
	isDefault,
});

/** カテゴリに属さない general・top、カテゴリ a（a1・a2）、カテゴリ b（空） */
const base: ChannelLayout = {
	channels: [ch("general", true), ch("top")],
	categories: [
		{ id: "a", name: "A", channels: [ch("a1"), ch("a2")] },
		{ id: "b", name: "B", channels: [] },
	],
};

describe("moveChannel", () => {
	it("同じ並びの中で 1 つ上・下へ動かす", () => {
		expect(toLayoutRequest(moveChannel(base, "top", -1))).toEqual({
			channels: ["top", "general"],
			categories: [
				{ id: "a", channels: ["a1", "a2"] },
				{ id: "b", channels: [] },
			],
		});
		expect(
			toLayoutRequest(moveChannel(base, "a1", 1)).categories[0]?.channels,
		).toEqual(["a2", "a1"]);
	});

	it("端では動かさず、ほかの並びへははみ出さない", () => {
		expect(sameOrder(moveChannel(base, "general", -1), base)).toBe(true);
		expect(sameOrder(moveChannel(base, "top", 1), base)).toBe(true);
		expect(sameOrder(moveChannel(base, "a2", 1), base)).toBe(true);
	});
});

describe("moveCategory", () => {
	it("カテゴリを 1 つ上・下へ動かし、端では動かさない", () => {
		expect(moveCategory(base, "b", -1).categories.map((k) => k.id)).toEqual([
			"b",
			"a",
		]);
		expect(sameOrder(moveCategory(base, "a", -1), base)).toBe(true);
		expect(sameOrder(moveCategory(base, "b", 1), base)).toBe(true);
	});
});

describe("moveChannelTo", () => {
	it("カテゴリに入れる・出す・移すと、移した先の末尾に入る", () => {
		// 入れる
		expect(toLayoutRequest(moveChannelTo(base, "top", "a"))).toEqual({
			channels: ["general"],
			categories: [
				{ id: "a", channels: ["a1", "a2", "top"] },
				{ id: "b", channels: [] },
			],
		});
		// 出す
		expect(toLayoutRequest(moveChannelTo(base, "a1", null))).toEqual({
			channels: ["general", "top", "a1"],
			categories: [
				{ id: "a", channels: ["a2"] },
				{ id: "b", channels: [] },
			],
		});
		// 移す
		expect(toLayoutRequest(moveChannelTo(base, "a2", "b"))).toEqual({
			channels: ["general", "top"],
			categories: [
				{ id: "a", channels: ["a1"] },
				{ id: "b", channels: ["a2"] },
			],
		});
	});

	it("今と同じ並び・知らないチャンネルなら何も変えない", () => {
		expect(moveChannelTo(base, "a1", "a")).toBe(base);
		expect(moveChannelTo(base, "unknown", "b")).toBe(base);
	});

	it("元の並びは変えない", () => {
		const copy = structuredClone(base);
		moveChannelTo(base, "top", "a");
		moveChannel(base, "top", -1);
		moveCategory(base, "b", -1);
		expect(base).toEqual(copy);
	});
});

describe("findOverLimit", () => {
	const many = (prefix: string, count: number) =>
		Array.from({ length: count }, (_, i) => ch(`${prefix}${i}`));

	it("どの並びも 10 個以下なら null", () => {
		expect(
			findOverLimit({
				channels: many("t", 10),
				categories: [{ id: "a", name: "A", channels: many("a", 10) }],
			}),
		).toBeNull();
	});

	it("11 個になった並びを返す（カテゴリに属さない並びは name が null）", () => {
		expect(findOverLimit({ channels: many("t", 11), categories: [] })).toEqual({
			name: null,
			limit: 10,
		});
		expect(
			findOverLimit({
				channels: [],
				categories: [{ id: "a", name: "A", channels: many("a", 11) }],
			}),
		).toEqual({ name: "A", limit: 10 });
	});
});
