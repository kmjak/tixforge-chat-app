import {
	formatExpiresAt,
	INVITE_EXPIRY_OPTIONS,
	inviteUrl,
	parseExpiryOption,
} from "./invites";

describe("招待リンクの有効期限の選択肢", () => {
	it("1・6・12・24・48 時間と無制限", () => {
		expect(INVITE_EXPIRY_OPTIONS.map((o) => o.label)).toEqual([
			"1 時間",
			"6 時間",
			"12 時間",
			"24 時間",
			"48 時間",
			"無制限",
		]);
	});

	it.each([
		["24", 24],
		["none", null],
		["2", undefined],
		["", undefined],
	])("parseExpiryOption(%p) は %p", (value, expected) => {
		expect(parseExpiryOption(value)).toBe(expected);
	});
});

describe("inviteUrl", () => {
	it("web の /invites/{token} の URL を作る", () => {
		expect(inviteUrl("http://localhost:3000", "abc_-1")).toBe(
			"http://localhost:3000/invites/abc_-1",
		);
	});
});

describe("formatExpiresAt", () => {
	it("null は無制限、日時は日本時間で表示する", () => {
		expect(formatExpiresAt(null)).toBe("無制限");
		expect(formatExpiresAt("2026-10-19T00:00:00.000Z")).toBe(
			"2026/10/19 9:00:00",
		);
	});
});
