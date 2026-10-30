import type {
	CategoryService,
	ChannelService,
	ProfileService,
	ServerService,
} from "@chat-app/db";
import type {
	ErrorResponse,
	HealthResponse,
	MeResponse,
} from "@chat-app/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AuthService, AuthUser } from "./auth";
import { registerCategoryRoutes } from "./categories";
import { registerChannelRoutes } from "./channels";
import { ApiError } from "./errors";
import { registerProfileRoutes } from "./profiles";
import { registerServerRoutes } from "./servers";

/** ハンドラで c.get() で取り出せる値。ログイン確認を通った API では user が必ずある */
export type AppEnv = { Variables: { user: AuthUser } };

export type AppDeps = {
	/** DB に接続できれば true を返す */
	pingDb: () => Promise<boolean>;
	/** 認証（/api/auth/* の処理と、ログインしているかの確認） */
	auth: AuthService;
	/** 自分のプロフィールの操作 */
	profiles: ProfileService;
	/** サーバー・メンバー・招待リンクの操作 */
	servers: ServerService;
	/** チャンネルの操作 */
	channels: ChannelService;
	/** チャンネルのカテゴリの操作 */
	categories: CategoryService;
	/** web の origin。この origin からの cookie 付きの呼び出しを受け付ける */
	webOrigin: string;
};

/**
 * ログインせずに使える API のパスの接頭辞。/api の下はこれ以外すべてログインが必要
 * （docs/context/uri.md「ログインの確認」）。/health は /api の外なので対象外
 */
const PUBLIC_API_PREFIXES = ["/api/auth/"];

/** HTTPException のステータスに対応するエラーの code（docs/context/uri.md「エラーの共通形式」） */
const ERROR_CODES: Record<number, string> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	405: "METHOD_NOT_ALLOWED",
	409: "CONFLICT",
	413: "PAYLOAD_TOO_LARGE",
	415: "UNSUPPORTED_MEDIA_TYPE",
	422: "UNPROCESSABLE_ENTITY",
	429: "TOO_MANY_REQUESTS",
};

/** API のリクエストの本文の大きさの上限。超えたら 413 PAYLOAD_TOO_LARGE（読み込む前に断る） */
const MAX_BODY_BYTES = 100 * 1024;

const INTERNAL_SERVER_ERROR: ErrorResponse = {
	code: "INTERNAL_SERVER_ERROR",
	message: "Internal Server Error",
};

export function createApp({
	pingDb,
	auth,
	profiles,
	servers,
	channels,
	categories,
	webOrigin,
}: AppDeps) {
	const app = new Hono<AppEnv>();

	// web（別の origin）から cookie 付きで呼べるようにする。プリフライト（OPTIONS）はここで返る
	app.use(
		"/api/*",
		cors({
			origin: webOrigin,
			credentials: true,
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	);

	app.use(
		"/api/*",
		bodyLimit({
			maxSize: MAX_BODY_BYTES,
			onError: () => {
				throw new ApiError(
					413,
					"PAYLOAD_TOO_LARGE",
					"Request body is too large",
				);
			},
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

	app.get("/api/me", async (c) => {
		const user = c.get("user");
		const defaultProfile = await profiles.findDefault(user.id);
		if (!defaultProfile) {
			// サインアップの trigger で必ず作るので、起きないはず
			throw new Error(
				`デフォルトのプロフィールがありません（user: ${user.id}）`,
			);
		}
		return c.json<MeResponse>({
			id: user.id,
			email: user.email,
			defaultProfile,
		});
	});

	registerProfileRoutes(app, profiles);
	registerServerRoutes(app, servers);
	registerChannelRoutes(app, channels);
	registerCategoryRoutes(app, categories);

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
		// 意図して投げた 4xx（validator の 400 など）は、そのステータスのまま返す
		if (error instanceof HTTPException && error.status < 500) {
			const status = error.status as ContentfulStatusCode;
			return c.json<ErrorResponse>(
				{
					code:
						error instanceof ApiError
							? error.code
							: (ERROR_CODES[status] ?? `HTTP_${status}`),
					message: error.message || "Request Error",
				},
				status,
			);
		}
		// それ以外は 500。理由には内部の情報が含まれることがあるので、ログにだけ出す
		console.error("API でエラーが起きました:", error);
		return c.json<ErrorResponse>(INTERNAL_SERVER_ERROR, 500);
	});

	return app;
}
