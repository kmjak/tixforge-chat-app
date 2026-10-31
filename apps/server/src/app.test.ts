import type {
	CategoryService,
	ChannelService,
	ProfileService,
	ServerService,
} from "@chat-app/db";
import type { HealthResponse } from "@chat-app/shared";
import { HTTPException } from "hono/http-exception";
import { createApp } from "./app";
import { ApiError, readJson } from "./errors";
import type { RealtimeHub } from "./realtime";

/** /health のテストでは認証を使わない */
const deps = {
	auth: {
		handler: async () => new Response(null, { status: 404 }),
		getSession: async () => null,
	},
	profiles: {
		findDefault: async () => undefined,
		list: async () => [],
		get: async () => undefined,
		create: async () => ({ ok: false, reason: "limit" }),
		update: async () => undefined,
		setDefault: async () => undefined,
		remove: async () => ({ ok: false, reason: "not-found" }),
		listUsages: async () => undefined,
	} satisfies ProfileService,
	servers: {} as ServerService,
	channels: {} as ChannelService,
	categories: {} as CategoryService,
	realtime: {} as RealtimeHub,
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

describe("エラーの共通形式", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	/** ログイン済みとして扱う app（ログイン確認は差し替える） */
	function loggedInApp() {
		return createApp({
			...deps,
			pingDb: async () => true,
			auth: {
				...deps.auth,
				getSession: async () => ({
					user: { id: "u1", email: "u1@example.com" },
					sessionId: "s1",
				}),
			},
		});
	}

	it.each([
		[400, "BAD_REQUEST", "Malformed JSON"],
		[403, "FORBIDDEN", "Forbidden"],
		[418, "HTTP_418", "I'm a teapot"],
	])(
		"処理の中で HTTPException(%i) を投げると、そのステータスのまま code %s で返す",
		async (status, code, message) => {
			const app = loggedInApp();
			app.get("/api/test/http-exception", () => {
				throw new HTTPException(status as 400, { message });
			});

			const res = await app.request("/api/test/http-exception");

			expect(res.status).toBe(status);
			expect(await res.json()).toEqual({ code, message });
		},
	);

	it("ApiError を投げると、そのステータスと code で返す", async () => {
		const app = loggedInApp();
		app.get("/api/test/api-error", () => {
			throw new ApiError(409, "SOMETHING_CONFLICTED", "Conflicted");
		});

		const res = await app.request("/api/test/api-error");

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({
			code: "SOMETHING_CONFLICTED",
			message: "Conflicted",
		});
	});

	it("JSON として読めない本文は 400 BAD_REQUEST を返す", async () => {
		const app = loggedInApp();
		app.post("/api/test/json", async (c) => c.json(await readJson(c)));

		const res = await app.request("/api/test/json", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{broken",
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			code: "BAD_REQUEST",
			message: "Malformed JSON",
		});
	});

	it.each([
		["text/plain", "text/plain"],
		["指定なし", undefined],
	])(
		"Content-Type が application/json でない本文（%s）は 415 UNSUPPORTED_MEDIA_TYPE を返す",
		async (_, contentType) => {
			const app = loggedInApp();
			app.post("/api/test/json", async (c) => c.json(await readJson(c)));

			const res = await app.request("/api/test/json", {
				method: "POST",
				headers: contentType ? { "Content-Type": contentType } : {},
				body: JSON.stringify({ name: "x" }),
			});

			expect(res.status).toBe(415);
			expect(await res.json()).toMatchObject({
				code: "UNSUPPORTED_MEDIA_TYPE",
			});
		},
	);

	it("Content-Type に charset が付いていても JSON として読む", async () => {
		const app = loggedInApp();
		app.post("/api/test/json", async (c) => c.json(await readJson(c)));

		const res = await app.request("/api/test/json", {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: JSON.stringify({ name: "x" }),
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ name: "x" });
	});

	it("100 KB を超える本文は、読み込まずに 413 PAYLOAD_TOO_LARGE を返す", async () => {
		const app = loggedInApp();
		const handler = jest.fn((c) => c.json({}));
		app.post("/api/test/json", handler);

		const res = await app.request("/api/test/json", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ bio: "a".repeat(100 * 1024) }),
		});

		expect(res.status).toBe(413);
		expect(await res.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
		expect(handler).not.toHaveBeenCalled();
	});

	it("ログイン確認（getSession）が例外を投げると、500 INTERNAL_SERVER_ERROR を返し、理由は応答に含めない", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const app = createApp({
			...deps,
			pingDb: async () => true,
			auth: {
				...deps.auth,
				getSession: async () => {
					throw new Error("connection refused: db.internal:5432");
				},
			},
		});

		const res = await app.request("/api/me");

		expect(res.status).toBe(500);
		const body = await res.text();
		expect(JSON.parse(body)).toEqual({
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal Server Error",
		});
		expect(body).not.toContain("db.internal");
		expect(log).toHaveBeenCalled();
	});
});

describe("/api/auth/* の後の WebSocket の確かめ直し", () => {
	function appWith({
		getSession,
		revalidateUser = async () => {},
	}: {
		getSession: () => Promise<{
			user: { id: string; email: string };
			sessionId: string;
		} | null>;
		revalidateUser?: (userId: string) => Promise<void>;
	}) {
		const handler = jest.fn(async () => new Response("{}", { status: 200 }));
		const revalidate = jest.fn(revalidateUser);
		const readSession = jest.fn(getSession);
		const app = createApp({
			...deps,
			pingDb: async () => true,
			auth: { handler, getSession: readSession },
			realtime: { revalidateUser: revalidate } as unknown as RealtimeHub,
		});
		return { app, handler, revalidate, readSession };
	}

	const loggedIn = async () => ({
		user: { id: "u1", email: "u1@example.com" },
		sessionId: "s1",
	});

	it("セッションを無効にしうる操作が成功したら、そのアカウントの接続を確かめ直す", async () => {
		const { app, revalidate } = appWith({ getSession: loggedIn });

		const res = await app.request("/api/auth/sign-out", { method: "POST" });

		expect(res.status).toBe(200);
		expect(revalidate).toHaveBeenCalledWith("u1");
	});

	it("セッションを無効にしない操作では、確かめ直さない（セッションも読まない）", async () => {
		const { app, revalidate, readSession } = appWith({ getSession: loggedIn });

		const res = await app.request("/api/auth/update-user", { method: "POST" });

		expect(res.status).toBe(200);
		expect(revalidate).not.toHaveBeenCalled();
		expect(readSession).not.toHaveBeenCalled();
	});

	it("確かめ直しの前にセッションを読めなくても、Better Auth の応答をそのまま返す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const { app, handler, revalidate } = appWith({
			getSession: async () => {
				throw new Error("DB のタイムアウト");
			},
		});

		const res = await app.request("/api/auth/sign-out", { method: "POST" });

		expect(res.status).toBe(200);
		expect(handler).toHaveBeenCalled();
		expect(revalidate).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("セッションの確認に失敗"),
			expect.any(Error),
		);
		log.mockRestore();
	});

	it("確かめ直しに失敗しても、Better Auth の応答をそのまま返す", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const { app, revalidate } = appWith({
			getSession: loggedIn,
			revalidateUser: async () => {
				throw new Error("DB のタイムアウト");
			},
		});

		const res = await app.request("/api/auth/sign-out", { method: "POST" });

		expect(res.status).toBe(200);
		expect(revalidate).toHaveBeenCalledWith("u1");
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("接続の確かめ直しに失敗"),
			expect.any(Error),
		);
		log.mockRestore();
	});
});
