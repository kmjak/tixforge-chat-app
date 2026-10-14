import type { HealthResponse } from "@chat-app/shared";
import { app } from "./app";

describe("app", () => {
	it("GET /health は 200 と status ok を返す", async () => {
		const res = await app.request("/health");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual<HealthResponse>({ status: "ok" });
	});
});
