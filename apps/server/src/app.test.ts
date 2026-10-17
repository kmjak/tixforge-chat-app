import type { HealthResponse } from "@chat-app/shared";
import { createApp } from "./app";

/** /health のテストでは認証を使わない */
const deps = {
	auth: {
		handler: async () => new Response(null, { status: 404 }),
		getSession: async () => null,
	},
	webOrigin: "http://localhost:3000",
};

describe("GET /health", () => {
	it("DB に接続できれば 200 と db ok を返す", async () => {
		const app = createApp({ ...deps, pingDb: async () => true });

		const res = await app.request("/health");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual<HealthResponse>({
			status: "ok",
			db: "ok",
		});
	});

	it("DB に接続できなければ 503 と db error を返す", async () => {
		const app = createApp({ ...deps, pingDb: async () => false });

		const res = await app.request("/health");

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual<HealthResponse>({
			status: "error",
			db: "error",
		});
	});
});
