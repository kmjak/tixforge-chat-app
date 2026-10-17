import {
	cookieFrom,
	PASSWORD,
	setupTestApp,
	type TestApp,
} from "./test-helpers";

let t: TestApp;

beforeAll(async () => {
	t = await setupTestApp();
	// 「除外していない新しい API」の代わりに、app を作った後でルートを足す
	t.app.get("/api/test/whoami", (c) => c.json({ id: c.get("user").id }));
	t.app.get("/api/test/throw", () => {
		throw new Error("boom");
	});
});

afterAll(async () => {
	await t.close();
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** サインアップしてログインした状態の cookie と、アカウントの id を返す */
async function signUpAndLogin(name: string, email: string) {
	const res = await t.signUp(name, email);
	const body = (await res.json()) as { user: { id: string } };
	return { cookie: cookieFrom(res), userId: body.user.id };
}

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Unauthorized" };

describe("除外していない新しい API は、何もしなくてもログインが必須になる", () => {
	it("未ログインなら 401 とエラーの共通形式を返す", async () => {
		const res = await t.request("GET", "/api/test/whoami");

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(UNAUTHORIZED);
	});

	it("ログイン済みなら、ハンドラで呼び出したアカウントを取り出せる", async () => {
		const { cookie, userId } = await signUpAndLogin(
			"Who",
			"whoami@example.com",
		);

		const res = await t.request("GET", "/api/test/whoami", { cookie });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ id: userId });
	});

	it("存在しない API も、未ログインなら 401 を返す（存在するかを知らせない）", async () => {
		const res = await t.request("GET", "/api/does-not-exist");

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(UNAUTHORIZED);
	});
});

describe("ヘルスチェックと Better Auth の認証 API は未ログインでも使える", () => {
	it("GET /health", async () => {
		const res = await t.request("GET", "/health");

		expect(res.status).toBe(200);
	});

	it("GET /api/auth/get-session は null を返す", async () => {
		const res = await t.request("GET", "/api/auth/get-session");

		expect(res.status).toBe(200);
		expect(await res.json()).toBeNull();
	});

	it("サインアップとサインインができる", async () => {
		const signUp = await t.signUp("Public", "public@example.com");
		expect(signUp.status).toBe(200);

		const signIn = await t.request("POST", "/api/auth/sign-in/email", {
			body: { email: "public@example.com", password: PASSWORD },
		});
		expect(signIn.status).toBe(200);
	});

	it("CORS のプリフライト（OPTIONS）はログイン無しで通る", async () => {
		const res = await t.app.request("/api/test/whoami", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3000",
				"Access-Control-Request-Method": "GET",
			},
		});

		expect(res.status).toBe(204);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:3000",
		);
	});
});

describe("エラーの共通形式", () => {
	it("ログイン済みで存在しない API を呼ぶと 404 NOT_FOUND を返す", async () => {
		const { cookie } = await signUpAndLogin("NotFound", "notfound@example.com");

		const res = await t.request("GET", "/api/does-not-exist", { cookie });

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			code: "NOT_FOUND",
			message: "Not Found",
		});
	});

	it("処理の中で例外が起きると 500 INTERNAL_SERVER_ERROR を返し、理由は応答に含めない", async () => {
		const log = jest.spyOn(console, "error").mockImplementation(() => {});
		const { cookie } = await signUpAndLogin("Throw", "throw@example.com");

		const res = await t.request("GET", "/api/test/throw", { cookie });

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal Server Error",
		});
		expect(log).toHaveBeenCalled();
	});
});

describe("GET /api/me", () => {
	it("未ログインで GET /api/me を呼ぶと 401 が返る", async () => {
		const res = await t.request("GET", "/api/me");

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(UNAUTHORIZED);
	});

	it("壊れた cookie で GET /api/me を呼ぶと 401 が返る", async () => {
		const res = await t.request("GET", "/api/me", {
			cookie: "better-auth.session_token=broken.value",
		});

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(UNAUTHORIZED);
	});

	it("ログイン済みで GET /api/me を呼ぶと、アカウントの id・メールアドレス・デフォルトプロフィールが返る", async () => {
		const me = await signUpAndLogin(" Taro ", "me@example.com");
		// 別のアカウントの情報が混ざらないことも確かめる
		await signUpAndLogin("Hanako", "hanako-me@example.com");

		const res = await t.request("GET", "/api/me", { cookie: me.cookie });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: me.userId,
			email: "me@example.com",
			defaultProfile: { id: expect.any(String), name: "Taro", bio: "" },
		});
	});

	it("ログアウトした後のセッションで呼ぶと 401 が返る", async () => {
		const { cookie } = await signUpAndLogin("Out", "signout-me@example.com");
		const signOut = await t.request("POST", "/api/auth/sign-out", { cookie });
		expect(signOut.status).toBe(200);

		const res = await t.request("GET", "/api/me", { cookie });

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(UNAUTHORIZED);
	});

	it("期限切れのセッションで呼ぶと 401 が返る", async () => {
		const { cookie, userId } = await signUpAndLogin(
			"Expired",
			"expired-me@example.com",
		);
		await t.db.$client.query(
			"UPDATE session SET expires_at = now() - interval '1 minute' WHERE user_id = $1",
			[userId],
		);

		const res = await t.request("GET", "/api/me", { cookie });

		expect(res.status).toBe(401);
	});
});
