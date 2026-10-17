import { isLoggedIn } from "./session";

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

describe("isLoggedIn", () => {
	it("cookie を付けて get-session を呼び、セッションがあれば true を返す", async () => {
		const fetch = mockFetch(Response.json({ session: { id: "s" }, user: {} }));

		await expect(isLoggedIn(SERVER_URL, "a=b")).resolves.toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			`${SERVER_URL}/api/auth/get-session`,
			expect.objectContaining({ headers: { cookie: "a=b" } }),
		);
	});

	it("get-session が null を返したら false を返す", async () => {
		mockFetch(Response.json(null));

		await expect(isLoggedIn(SERVER_URL, "a=b")).resolves.toBe(false);
	});

	it("cookie が無ければ server を呼ばずに false を返す", async () => {
		const fetch = mockFetch(Response.json(null));

		await expect(isLoggedIn(SERVER_URL, null)).resolves.toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([
		["server に届かない", new Error("ECONNREFUSED")],
		["500 を返す", new Response("error", { status: 500 })],
	])("%s なら false を返す", async (_, response) => {
		mockFetch(response);

		await expect(isLoggedIn(SERVER_URL, "a=b")).resolves.toBe(false);
	});
});
