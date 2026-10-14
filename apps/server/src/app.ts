import type { HealthResponse } from "@chat-app/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";

export type AppDeps = {
	/** DB に接続できれば true を返す */
	pingDb: () => Promise<boolean>;
	/** /api/auth/* を扱う（Better Auth の handler） */
	auth: { handler: (request: Request) => Promise<Response> };
	/** web の origin。この origin からの cookie 付きの呼び出しを受け付ける */
	webOrigin: string;
};

export function createApp({ pingDb, auth, webOrigin }: AppDeps) {
	const app = new Hono();

	// web（別の origin）から cookie 付きで呼べるようにする
	app.use(
		"/api/*",
		cors({
			origin: webOrigin,
			credentials: true,
			allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	);

	app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

	app.get("/health", async (c) => {
		if (await pingDb()) {
			return c.json<HealthResponse>({ status: "ok", db: "ok" });
		}
		return c.json<HealthResponse>({ status: "error", db: "error" }, 503);
	});

	return app;
}
