import type { HealthResponse } from "@chat-app/shared";
import { createApp } from "./app";

describe("GET /health", () => {
	it("DB に接続できれば 200 と db ok を返す", async () => {
		const app = createApp({ pingDb: async () => true });

		const res = await app.request("/health");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual<HealthResponse>({
			status: "ok",
			db: "ok",
		});
	});

	it("DB に接続できなければ 503 と db error を返す", async () => {
		const app = createApp({ pingDb: async () => false });

		const res = await app.request("/health");

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual<HealthResponse>({
			status: "error",
			db: "error",
		});
	});
});
