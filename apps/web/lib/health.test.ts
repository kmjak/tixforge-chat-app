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
		const spy = mockFetch(async () => Response.json({ status: "ok" }));

		await expect(fetchHealth(serverUrl)).resolves.toEqual({ status: "ok" });
		expect(spy).toHaveBeenCalledWith(
			"http://localhost:3001/health",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("200 以外の応答なら null を返す", async () => {
		mockFetch(async () => new Response("error", { status: 500 }));

		await expect(fetchHealth(serverUrl)).resolves.toBeNull();
	});

	it("200 でも status が ok でない応答なら null を返す", async () => {
		mockFetch(async () => Response.json({}));

		await expect(fetchHealth(serverUrl)).resolves.toBeNull();
	});

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
