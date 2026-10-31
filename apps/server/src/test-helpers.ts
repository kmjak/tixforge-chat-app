// テストだけで使う補助関数。本物のマイグレーションを当てた PGlite の DB で app を組み立てる

import type { AddressInfo } from "node:net";
import {
	createCategoryService,
	createChannelService,
	createProfileService,
	createServerService,
	listRoomMemberIds,
	PROFILE_USAGE_SOURCES,
	type ProfileUsageSource,
} from "@chat-app/db";
import { createTestDb, type TestDb } from "@chat-app/db/testing";
import { WS_PATH } from "@chat-app/shared";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import {
	createRealtimeHub,
	createWebSocketServer,
	type RealtimeHub,
} from "./realtime";

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
	/** WebSocket の配信の仕組み（テストから部屋に送ったり、生存確認を動かしたりする） */
	realtime: RealtimeHub;
	/**
	 * app を実際のポート（空いているもの）で listen させ、WebSocket の接続先の URL を返す
	 * （WebSocket の upgrade は app.request では通らないため）。close で止まる
	 */
	listen: () => Promise<string>;
	/** DB を閉じ、listen していれば止める（afterAll で呼ぶ） */
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
	const auth = createAuth({
		db,
		secret: "test-secret-test-secret-test-secret",
		baseURL: "http://localhost:3001",
		webOrigin: WEB_ORIGIN,
		rateLimit: false,
	});
	// 生存確認はテストから checkConnections で動かす（start しない）
	const realtime = createRealtimeHub({
		listRoomMemberIds: (room) => listRoomMemberIds(db, room),
		getSession: auth.getSession,
	});
	const app = createApp({
		pingDb: async () => true,
		auth,
		profiles: createProfileService(db, { usageSources }),
		servers: createServerService(db),
		channels: createChannelService(db),
		categories: createCategoryService(db),
		realtime,
		webOrigin: WEB_ORIGIN,
	});
	let server: ReturnType<typeof serve> | undefined;

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
		realtime,
		listen: () =>
			new Promise((resolve) => {
				server = serve(
					{
						fetch: app.fetch,
						port: 0,
						websocket: { server: createWebSocketServer() },
					},
					(info: AddressInfo) => {
						resolve(`ws://localhost:${info.port}${WS_PATH}`);
					},
				);
			}),
		close: async () => {
			if (server) {
				const listening = server;
				// 開いている WebSocket の接続ごと閉じる
				await new Promise((resolve) => {
					listening.close(resolve);
					if ("closeAllConnections" in listening) {
						listening.closeAllConnections();
					}
				});
			}
			await db.$client.close();
		},
	};
}

/** Set-Cookie から、次のリクエストに付ける Cookie ヘッダを作る */
export function cookieFrom(res: Response): string {
	return res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
}
