// テストだけで使う補助関数。本物のマイグレーションを当てた PGlite の DB で app を組み立てる
import {
	createProfileService,
	createServerService,
	PROFILE_USAGE_SOURCES,
	type ProfileUsageSource,
} from "@chat-app/db";
import { createTestDb, type TestDb } from "@chat-app/db/testing";
import { createApp } from "./app";
import { createAuth } from "./auth";

export const WEB_ORIGIN = "http://localhost:3000";
export const PASSWORD = "Passw0rd!";

export type TestApp = {
	db: TestDb;
	app: ReturnType<typeof createApp>;
	/** web から呼んだときと同じく、Origin と（あれば）cookie を付けて API を呼ぶ */
	request: (
		method: string,
		path: string,
		options?: { body?: unknown; cookie?: string },
	) => Promise<Response>;
	signUp: (name: string, email: string, password?: string) => Promise<Response>;
	/** DB を閉じる（afterAll で呼ぶ） */
	close: () => Promise<void>;
};

/**
 * テスト用の DB と app を作る。回数の制限は、同じ相手から何度も呼ぶので無効にする。
 * 使用先の source は、指定しなければ登録済みの一覧
 */
export async function setupTestApp({
	usageSources = PROFILE_USAGE_SOURCES,
}: {
	/** プロフィールの使用先の source。既定は登録済みの一覧（サーバーなど）。テストで偽物に差し替えられる */
	usageSources?: ProfileUsageSource[];
} = {}): Promise<TestApp> {
	const db = await createTestDb();
	const app = createApp({
		pingDb: async () => true,
		auth: createAuth({
			db,
			secret: "test-secret-test-secret-test-secret",
			baseURL: "http://localhost:3001",
			webOrigin: WEB_ORIGIN,
			rateLimit: false,
		}),
		profiles: createProfileService(db, { usageSources }),
		servers: createServerService(db),
		webOrigin: WEB_ORIGIN,
	});

	const request: TestApp["request"] = (method, path, { body, cookie } = {}) => {
		const headers = new Headers({ Origin: WEB_ORIGIN });
		if (body !== undefined) {
			headers.set("Content-Type", "application/json");
		}
		if (cookie) {
			headers.set("Cookie", cookie);
		}
		return Promise.resolve(
			app.request(path, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
		);
	};

	return {
		db,
		app,
		request,
		signUp: (name, email, password = PASSWORD) =>
			request("POST", "/api/auth/sign-up/email", {
				body: { name, email, password },
			}),
		close: () => db.$client.close(),
	};
}

/** Set-Cookie から、次のリクエストに付ける Cookie ヘッダを作る */
export function cookieFrom(res: Response): string {
	return res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
}
