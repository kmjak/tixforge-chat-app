import {
	cookieFrom,
	PASSWORD,
	setupTestApp,
	type TestApp,
	WEB_ORIGIN,
} from "./test-helpers";

let t: TestApp;

beforeAll(async () => {
	t = await setupTestApp();
});

afterAll(async () => {
	await t.close();
});

function request(...args: Parameters<TestApp["request"]>) {
	return t.request(...args);
}

function signUp(...args: Parameters<TestApp["signUp"]>) {
	return t.signUp(...args);
}

// db と server で drizzle-orm の実体が分かれる（peer の違い）ので、テストの確認は SQL で行う
async function findUser(email: string) {
	const { rows } = await t.db.$client.query<{ id: string; name: string }>(
		'SELECT id, name FROM "user" WHERE email = $1',
		[email],
	);
	return rows[0];
}

async function countSessions(userId: string) {
	const { rows } = await t.db.$client.query<{ n: number }>(
		"SELECT count(*)::int AS n FROM session WHERE user_id = $1",
		[userId],
	);
	return rows[0]?.n ?? 0;
}

describe("サインアップ", () => {
	it("name・メールアドレス・パスワードでサインアップできる", async () => {
		const res = await signUp("Taro", "taro@example.com");

		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: Record<string, unknown> };
		expect(body.user).toMatchObject({
			name: "Taro",
			email: "taro@example.com",
			emailVerified: false,
			image: null,
		});
		// id は UUID
		expect(body.user.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		// そのままログインした状態になる
		expect(cookieFrom(res)).not.toBe("");
		expect(await findUser("taro@example.com")).toBeDefined();
	});

	it("CORS：web の origin に cookie 付きの呼び出しを許す", async () => {
		const res = await signUp("Cors", "cors@example.com");

		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(WEB_ORIGIN);
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it.each([
		["8 文字未満", "Pa0!abc", "PASSWORD_TOO_SHORT"],
		["129 文字以上", `Pa0!${"a".repeat(125)}`, "PASSWORD_TOO_LONG"],
		["記号が無い", "Passw0rdd", "PASSWORD_TOO_WEAK"],
		["英小文字が無い", "PASSW0RD!", "PASSWORD_TOO_WEAK"],
		["英大文字が無い", "passw0rd!", "PASSWORD_TOO_WEAK"],
	])(
		"条件を満たさないパスワードではサインアップできない（%s → %s）",
		async (_, password, code) => {
			const email = `weak-${code}-${password.length}-${password[0]}@example.com`;

			const res = await signUp("Weak", email, password);

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code });
			expect(await findUser(email)).toBeUndefined();
		},
	);

	it.each([
		["空", ""],
		["空白だけ", "   "],
		["前後の空白を除いて 33 文字", ` ${"あ".repeat(33)} `],
	])(
		"前後の空白を除いて 1〜32 文字でない name ではサインアップできない（%s）",
		async (label, name) => {
			const email = `invalid-name-${label.length}-${name.length}@example.com`;

			const res = await signUp(name, email);

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_NAME" });
			expect(await findUser(email)).toBeUndefined();
		},
	);

	it("前後の空白を除いて 1〜32 文字の name なら、除いた値で登録する", async () => {
		const res = await signUp(`  ${"あ".repeat(32)}  `, "trim@example.com");

		expect(res.status).toBe(200);
		expect((await findUser("trim@example.com"))?.name).toBe("あ".repeat(32));
	});

	it("サインアップしたアカウントにデフォルトプロフィールが 1 つある", async () => {
		await signUp(" Hanako ", "hanako@example.com");
		const user = await findUser("hanako@example.com");
		if (!user) {
			throw new Error("user が無い");
		}

		const { rows } = await t.db.$client.query(
			"SELECT name, bio, is_default FROM profiles WHERE user_id = $1",
			[user.id],
		);
		expect(rows).toEqual([{ name: "Hanako", bio: "", is_default: true }]);
	});

	it("登録済みのメールアドレスでは 422 を返す", async () => {
		await signUp("Dup", "dup@example.com");

		const res = await signUp("Dup", "dup@example.com");

		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({
			code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
		});
	});
});

describe("サインイン・サインアウト", () => {
	const email = "signin@example.com";
	let userId: string;

	beforeAll(async () => {
		await signUp("SignIn", email);
		const user = await findUser(email);
		if (!user) {
			throw new Error("user が無い");
		}
		userId = user.id;
	});

	it("メールアドレスとパスワードでサインインでき、セッションが DB に保存される", async () => {
		const before = await countSessions(userId);

		const res = await request("POST", "/api/auth/sign-in/email", {
			body: { email, password: PASSWORD },
		});

		expect(res.status).toBe(200);
		expect(await countSessions(userId)).toBe(before + 1);
		const session = await request("GET", "/api/auth/get-session", {
			cookie: cookieFrom(res),
		});
		expect(await session.json()).toMatchObject({
			session: { userId },
			user: { email },
		});
	});

	it.each([
		["メールアドレスが違う", "nobody@example.com", PASSWORD],
		["パスワードが違う", email, "Wrong0rd!"],
	])(
		"間違ったメールアドレスまたはパスワードではサインインできない（%s）",
		async (_, inputEmail, password) => {
			const before = await countSessions(userId);

			const res = await request("POST", "/api/auth/sign-in/email", {
				body: { email: inputEmail, password },
			});

			expect(res.status).toBe(401);
			expect(await res.json()).toMatchObject({
				code: "INVALID_EMAIL_OR_PASSWORD",
			});
			expect(cookieFrom(res)).not.toContain("session_token=");
			expect(await countSessions(userId)).toBe(before);
		},
	);

	it("ログアウトすると、セッションが無効になる", async () => {
		const signIn = await request("POST", "/api/auth/sign-in/email", {
			body: { email, password: PASSWORD },
		});
		const cookie = cookieFrom(signIn);
		const before = await countSessions(userId);

		const res = await request("POST", "/api/auth/sign-out", { cookie });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true });
		expect(await countSessions(userId)).toBe(before - 1);
		const session = await request("GET", "/api/auth/get-session", { cookie });
		expect(await session.json()).toBeNull();
	});

	it("未ログインなら get-session は null を返す", async () => {
		const res = await request("GET", "/api/auth/get-session");

		expect(res.status).toBe(200);
		expect(await res.json()).toBeNull();
	});
});

describe("サインアップ以外の経路でも name とパスワードを確かめる", () => {
	const email = "update@example.com";
	let cookie: string;

	beforeAll(async () => {
		cookie = cookieFrom(await signUp("Update", email));
	});

	it("パスワードの変更でも、条件を満たさないパスワードには変えられない", async () => {
		const res = await request("POST", "/api/auth/change-password", {
			body: { currentPassword: PASSWORD, newPassword: "password1" },
			cookie,
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "PASSWORD_TOO_WEAK" });
		const signIn = await request("POST", "/api/auth/sign-in/email", {
			body: { email, password: PASSWORD },
		});
		expect(signIn.status).toBe(200);
	});

	it("パスワードの変更で、条件を満たすパスワードには変えられる", async () => {
		const res = await request("POST", "/api/auth/change-password", {
			body: { currentPassword: PASSWORD, newPassword: "N3w-Passw0rd" },
			cookie,
		});

		expect(res.status).toBe(200);
		const signIn = await request("POST", "/api/auth/sign-in/email", {
			body: { email, password: "N3w-Passw0rd" },
		});
		expect(signIn.status).toBe(200);
	});

	it.each([
		["空白だけ", "   "],
		["33 文字", "あ".repeat(33)],
	])(
		"ユーザーの更新でも、1〜32 文字でない name（%s）には変えられない",
		async (_, name) => {
			const res = await request("POST", "/api/auth/update-user", {
				body: { name },
				cookie,
			});

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_NAME" });
			expect((await findUser(email))?.name).toBe("Update");
		},
	);

	it("ユーザーの更新の name は、前後の空白を除いて保存する", async () => {
		const res = await request("POST", "/api/auth/update-user", {
			body: { name: "  Renamed  " },
			cookie,
		});

		expect(res.status).toBe(200);
		expect((await findUser(email))?.name).toBe("Renamed");
	});
});
