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

	it("包まれたエラーなら、元のエラーの内容を 1 行でログに出す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});

		await pingDb(
			fakeDb(async () => {
				throw new Error("Failed query: select 1\nparams: ", {
					cause: new Error("password authentication failed"),
				});
			}),
		);

		expect(log).toHaveBeenCalledWith(
			"DB に接続できません: password authentication failed",
		);
	});
	it("元のエラーが message の空な AggregateError なら、中のエラーの内容をログに出す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const cause = new AggregateError(
			[
				new Error("connect ECONNREFUSED ::1:5432"),
				new Error("connect ECONNREFUSED 127.0.0.1:5432"),
			],
			"",
		);

		await pingDb(
			fakeDb(async () => {
				throw new Error("Failed query: select 1", { cause });
			}),
		);

		expect(log).toHaveBeenCalledWith(
			"DB に接続できません: connect ECONNREFUSED ::1:5432, connect ECONNREFUSED 127.0.0.1:5432",
		);
	});

	it("message も中のエラーも無ければ、エラーのコードをログに出す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const cause = Object.assign(new AggregateError([], ""), {
			code: "ECONNREFUSED",
		});

		await pingDb(
			fakeDb(async () => {
				throw new Error("Failed query: select 1", { cause });
			}),
		);

		expect(log).toHaveBeenCalledWith("DB に接続できません: ECONNREFUSED");
	});
});
