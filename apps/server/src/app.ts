import type { HealthResponse } from "@chat-app/shared";
import { Hono } from "hono";

export type AppDeps = {
	/** DB に接続できれば true を返す */
	pingDb: () => Promise<boolean>;
};

export function createApp({ pingDb }: AppDeps) {
	const app = new Hono();

	app.get("/health", async (c) => {
		if (await pingDb()) {
			return c.json<HealthResponse>({ status: "ok", db: "ok" });
		}
		return c.json<HealthResponse>({ status: "error", db: "error" }, 503);
	});

	return app;
}
