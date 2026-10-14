import type { Db } from "./client";
import { pingDb } from "./health";

/** execute だけを持つ、偽物の Db を作る */
function fakeDb(execute: () => Promise<unknown>): Db {
	return { execute } as unknown as Db;
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("pingDb", () => {
	it("クエリが成功すれば true を返す", async () => {
		const execute = jest.fn(async () => ({ rows: [] }));

		await expect(pingDb(fakeDb(execute))).resolves.toBe(true);
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it("クエリが例外を投げたら、例外を投げずに false を返し、理由をログに出す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			pingDb(
				fakeDb(async () => {
					throw new Error("connection timeout");
				}),
			),
		).resolves.toBe(false);
		expect(log).toHaveBeenCalledWith("DB に接続できません: connection timeout");
	});
});
