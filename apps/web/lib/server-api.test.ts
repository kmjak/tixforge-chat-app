import { resolveServerGet, serverGet } from "./server-api";

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

describe("resolveServerGet", () => {
	it("成功なら本文を返す", () => {
		expect(resolveServerGet({ ok: true, data: { a: 1 } }, "/profiles")).toEqual(
			{
				type: "data",
				data: { a: 1 },
			},
		);
	});

	it("401（セッションが切れた）なら、今のパスに戻るサインインへリダイレクトする", () => {
		expect(
			resolveServerGet({ ok: false, status: 401 }, "/profiles/p1"),
		).toEqual({ type: "redirect", to: "/sign-in?redirect=%2Fprofiles%2Fp1" });
	});

	it("404 なら 404 の画面にする", () => {
		expect(
			resolveServerGet({ ok: false, status: 404 }, "/profiles/p1"),
		).toEqual({
			type: "not-found",
		});
	});

	it("それ以外の失敗はエラーにする", () => {
		expect(resolveServerGet({ ok: false, status: 500 }, "/profiles")).toEqual({
			type: "error",
			status: 500,
		});
	});
});
