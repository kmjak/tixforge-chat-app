import { schema } from "@chat-app/db";
import {
	isPasswordLengthValid,
	isStrongPassword,
	normalizeName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "@chat-app/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";

export type AuthOptions = {
	/** Drizzle のインスタンス（本番は node-postgres、テストは PGlite） */
	db: Parameters<typeof drizzleAdapter>[0];
	/** セッションの署名などに使う秘密の値（BETTER_AUTH_SECRET） */
	secret: string;
	/** server の URL（BETTER_AUTH_URL。例：http://localhost:3001） */
	baseURL: string;
	/** web の origin（WEB_ORIGIN。例：http://localhost:3000）。cookie 付きの呼び出しを受け付ける */
	webOrigin: string;
	/** 回数の制限（既定は有効）。同じ相手から何度も呼ぶテストでだけ無効にする */
	rateLimit?: boolean;
};

export type Auth = ReturnType<typeof createAuth>;

/**
 * サインアップの入力のうち、Better Auth が確かめないものを確かめる。
 * - name：前後の空白を除いて 1〜32 文字（デフォルトのプロフィールの name になるため）。除いた値で登録する
 * - パスワード：記号・英小文字・英大文字を 1 文字以上ずつ含む。長さが範囲外のときは見ない
 *   （Better Auth が PASSWORD_TOO_SHORT・PASSWORD_TOO_LONG を返すように）
 */
const validateSignUp = createAuthMiddleware(async (ctx) => {
	if (ctx.path !== "/sign-up/email") {
		return;
	}
	const { name, password } = ctx.body ?? {};
	// 型が違うときは Better Auth の入力の検査に任せる
	if (typeof name !== "string" || typeof password !== "string") {
		return;
	}

	const normalizedName = normalizeName(name);
	if (normalizedName === null) {
		throw new APIError("BAD_REQUEST", {
			code: "INVALID_NAME",
			message: "Name must be 1 to 32 characters",
		});
	}
	if (isPasswordLengthValid(password) && !isStrongPassword(password)) {
		throw new APIError("BAD_REQUEST", {
			code: "PASSWORD_TOO_WEAK",
			message:
				"Password must contain a symbol, a lowercase letter and an uppercase letter",
		});
	}

	return { context: { body: { ...ctx.body, name: normalizedName } } };
});

/** Better Auth のインスタンスを作る（/api/auth/* を扱う） */
export function createAuth({
	db,
	secret,
	baseURL,
	webOrigin,
	rateLimit = true,
}: AuthOptions) {
	return betterAuth({
		secret,
		baseURL,
		basePath: "/api/auth",
		trustedOrigins: [webOrigin],
		database: drizzleAdapter(db, {
			provider: "pg",
			schema,
			// サインアップの user と account（と trigger で作るプロフィール）を 1 つの transaction にする
			transaction: true,
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: PASSWORD_MIN_LENGTH,
			maxPasswordLength: PASSWORD_MAX_LENGTH,
		},
		hooks: { before: validateSignUp },
		// 既定では production のときだけ有効なので、常に有効にする（上限は既定のまま）
		rateLimit: { enabled: rateLimit },
		advanced: {
			// id は DB が UUID で作る（docs/context/schema.md の「id の規則」）
			database: { generateId: "uuid" },
		},
	});
}
