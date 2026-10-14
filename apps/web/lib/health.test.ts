import { fetchHealth, HEALTH_TIMEOUT_MS } from "./health";

const serverUrl = "http://localhost:3001";

function mockFetch(impl: () => Promise<Response>) {
	return jest.spyOn(globalThis, "fetch").mockImplementation(impl);
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe("fetchHealth", () => {
	it("200 と status ok が返れば、その応答を返す", async () => {
		const spy = mockFetch(async () =>
			Response.json({ status: "ok", db: "ok" }),
		);

		await expect(fetchHealth(serverUrl)).resolves.toEqual({
			status: "ok",
			db: "ok",
		});
		expect(spy).toHaveBeenCalledWith(
			"http://localhost:3001/health",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("503 と db error が返れば（server には届いたが DB が使えない）、その応答を返す", async () => {
		mockFetch(async () =>
			Response.json({ status: "error", db: "error" }, { status: 503 }),
		);

		await expect(fetchHealth(serverUrl)).resolves.toEqual({
			status: "error",
			db: "error",
		});
	});

	it("200・503 以外の応答なら null を返す", async () => {
		mockFetch(async () =>
			Response.json({ status: "error", db: "error" }, { status: 500 }),
		);

		await expect(fetchHealth(serverUrl)).resolves.toBeNull();
	});

	it("JSON でない応答なら null を返す", async () => {
		mockFetch(async () => new Response("error", { status: 503 }));

		await expect(fetchHealth(serverUrl)).resolves.toBeNull();
	});

	it.each([
		["200 で中身が空", 200, {}],
		["200 で db error", 200, { status: "error", db: "error" }],
		["503 で ok", 503, { status: "ok", db: "ok" }],
	])(
		"ステータスと中身が合わない応答（%s）なら null を返す",
		async (_label, status, body) => {
			mockFetch(async () => Response.json(body, { status }));

			await expect(fetchHealth(serverUrl)).resolves.toBeNull();
		},
	);

	it("接続できない（例外になる）なら null を返す", async () => {
		mockFetch(async () => {
			throw new TypeError("fetch failed");
		});

		await expect(fetchHealth(serverUrl)).resolves.toBeNull();
	});

	it("応答が無いままタイムアウトしたら null を返す", async () => {
		// AbortSignal.timeout は Node.js 内部のタイマーで動き、Jest の偽のタイマーでは進められない。
		// そのため、手で中断できる signal に差し替えて、タイムアウトした状況を作る
		const controller = new AbortController();
		const timeoutSpy = jest
			.spyOn(AbortSignal, "timeout")
			.mockReturnValue(controller.signal);
		// signal が中断されるまで応答しない fetch
		mockFetch(
			(_input?: unknown, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason),
					);
				}),
		);

		const result = fetchHealth(serverUrl);
		controller.abort(new DOMException("timeout", "TimeoutError"));

		await expect(result).resolves.toBeNull();
		expect(timeoutSpy).toHaveBeenCalledWith(HEALTH_TIMEOUT_MS);
	});
});
