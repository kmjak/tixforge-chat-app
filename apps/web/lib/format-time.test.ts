import { formatMessageTime } from "./format-time";

describe("formatMessageTime", () => {
	const now = new Date(2026, 9, 30, 15, 0);

	it("今日なら時刻だけ", () => {
		expect(
			formatMessageTime(new Date(2026, 9, 30, 9, 5).toISOString(), now),
		).toBe("09:05");
	});

	it("それより前なら日付と時刻", () => {
		expect(
			formatMessageTime(new Date(2026, 9, 29, 23, 59).toISOString(), now),
		).toBe("2026/10/29 23:59");
		expect(
			formatMessageTime(new Date(2025, 9, 30, 9, 5).toISOString(), now),
		).toBe("2025/10/30 09:05");
	});
});
