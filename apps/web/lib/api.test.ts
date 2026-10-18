import { callApi } from "./api";

const SERVER_URL = "http://localhost:3001";

function mockFetch(response: Response | Error) {
	return jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
		if (response instanceof Error) {
			throw response;
		}
		return response;
	});
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("callApi", () => {
	it("cookie 付きで呼び、成功なら本文を返す", async () => {
		const fetch = mockFetch(Response.json({ id: "p1" }, { status: 201 }));

		const result = await callApi(
			"/api/profiles",
			{ method: "POST", body: { name: "A" } },
			SERVER_URL,
		);

		expect(result).toEqual({ ok: true, data: { id: "p1" } });
		expect(fetch).toHaveBeenCalledWith(`${SERVER_URL}/api/profiles`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "A" }),
		});
	});

	it("204 なら本文は null", async () => {
		mockFetch(new Response(null, { status: 204 }));

		await expect(
			callApi("/api/profiles/p1", { method: "DELETE" }, SERVER_URL),
		).resolves.toEqual({ ok: true, data: null });
	});

	it("失敗ならエラーの code を返す", async () => {
		mockFetch(
			Response.json(
				{ code: "PROFILE_IN_USE", message: "in use" },
				{ status: 409 },
			),
		);

		await expect(callApi("/api/x", {}, SERVER_URL)).resolves.toEqual({
			ok: false,
			code: "PROFILE_IN_USE",
		});
	});

	it.each([
		[
			"code の無い本文（429 など）",
			Response.json({ message: "Too many" }, { status: 429 }),
		],
		["JSON でない本文", new Response("oops", { status: 500 })],
		["server に届かない", new Error("ECONNREFUSED")],
	])("%s なら code は undefined", async (_, response) => {
		mockFetch(response);

		await expect(callApi("/api/x", {}, SERVER_URL)).resolves.toEqual({
			ok: false,
			code: undefined,
		});
	});
});
