import type { ErrorResponse, HealthResponse } from "@chat-app/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthService, AuthUser } from "./auth";

/** ハンドラで c.get() で取り出せる値。ログイン確認を通った API では user が必ずある */
export type AppEnv = { Variables: { user: AuthUser } };

export type AppDeps = {
	/** DB に接続できれば true を返す */
	pingDb: () => Promise<boolean>;
	/** 認証（/api/auth/* の処理と、ログインしているかの確認） */
	auth: AuthService;
	/** web の origin。この origin からの cookie 付きの呼び出しを受け付ける */
	webOrigin: string;
};

/**
 * ログインせずに使える API のパスの接頭辞。/api の下はこれ以外すべてログインが必要
 * （docs/context/uri.md「ログインの確認」）。/health は /api の外なので対象外
 */
const PUBLIC_API_PREFIXES = ["/api/auth/"];

export function createApp({ pingDb, auth, webOrigin }: AppDeps) {
	const app = new Hono<AppEnv>();

	// web（別の origin）から cookie 付きで呼べるようにする。プリフライト（OPTIONS）はここで返る
	app.use(
		"/api/*",
		cors({
			origin: webOrigin,
			credentials: true,
			allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	);

	// /api の下は、既定でログインを必須にする。後から足した API・存在しない API も対象になる
	app.use("/api/*", async (c, next) => {
		if (PUBLIC_API_PREFIXES.some((prefix) => c.req.path.startsWith(prefix))) {
			return next();
		}
		const session = await auth.getSession(c.req.raw.headers);
		if (!session) {
			return c.json<ErrorResponse>(
				{ code: "UNAUTHORIZED", message: "Unauthorized" },
				401,
			);
		}
		c.set("user", session.user);
		await next();
	});

	app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

	app.get("/health", async (c) => {
		if (await pingDb()) {
			return c.json<HealthResponse>({ status: "ok", db: "ok" });
		}
		return c.json<HealthResponse>({ status: "error", db: "error" }, 503);
	});

	// Hono の既定の応答（テキスト）ではなく、エラーの共通形式で返す
	app.notFound((c) =>
		c.json<ErrorResponse>({ code: "NOT_FOUND", message: "Not Found" }, 404),
	);
	app.onError((error, c) => {
		// 理由には内部の情報が含まれることがあるので、ログにだけ出す
		console.error("API でエラーが起きました:", error);
		return c.json<ErrorResponse>(
			{ code: "INTERNAL_SERVER_ERROR", message: "Internal Server Error" },
			500,
		);
	});

	return app;
}
