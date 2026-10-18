import { serverGet } from "./server-api";

const SERVER_URL = "http://localhost:3001";

afterEach(() => {
	jest.restoreAllMocks();
});

describe("serverGet", () => {
	it("ブラウザの cookie を付けて呼び、成功なら本文を返す", async () => {
		const fetch = jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ profiles: [] }));

		const result = await serverGet(SERVER_URL, "/api/profiles", "a=b");

		expect(result).toEqual({ ok: true, data: { profiles: [] } });
		expect(fetch).toHaveBeenCalledWith(
			`${SERVER_URL}/api/profiles`,
			expect.objectContaining({
				headers: { cookie: "a=b" },
				cache: "no-store",
			}),
		);
	});

	it("失敗ならステータスを返す", async () => {
		jest
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ code: "NOT_FOUND" }, { status: 404 }));

		await expect(
			serverGet(SERVER_URL, "/api/profiles/x", "a=b"),
		).resolves.toEqual({
			ok: false,
			status: 404,
		});
	});
});
