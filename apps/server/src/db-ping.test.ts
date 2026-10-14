import type { Db } from "@chat-app/db";
import { createPingDb } from "./db-ping";

function fakeDeps(pingResult: boolean) {
	const db = {} as Db;
	return {
		createDb: jest.fn(() => db),
		pingDb: jest.fn(async () => pingResult),
	};
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("createPingDb", () => {
	it.each([
		["未設定", undefined],
		["空文字", ""],
		["空白だけ", "  "],
	])(
		"DATABASE_URL が%sなら DB に接続せず false を返す",
		async (_label, url) => {
			jest.spyOn(console, "warn").mockImplementation(() => {});
			const deps = fakeDeps(true);

			const ping = createPingDb(url, deps);

			await expect(ping()).resolves.toBe(false);
			expect(deps.createDb).not.toHaveBeenCalled();
			expect(deps.pingDb).not.toHaveBeenCalled();
		},
	);

	it("DATABASE_URL があれば、その接続先で DB を確かめた結果を返す", async () => {
		const deps = fakeDeps(true);

		const ping = createPingDb("postgresql://example", deps);

		await expect(ping()).resolves.toBe(true);
		expect(deps.createDb).toHaveBeenCalledWith("postgresql://example");
		expect(deps.pingDb).toHaveBeenCalledTimes(1);
	});
});
