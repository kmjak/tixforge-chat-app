import { createDb, pingDb } from "@chat-app/db";
import type { AppDeps } from "./app";

/**
 * DATABASE_URL から、/health が使う DB の確かめ方を作る。
 * DATABASE_URL が無い・空白だけなら DB には接続せず、常に「接続できない」とする
 */
export function createPingDb(
	databaseUrl: string | undefined,
	deps = { createDb, pingDb },
): AppDeps["pingDb"] {
	if (!databaseUrl?.trim()) {
		console.warn(
			"DATABASE_URL が設定されていません。DB には接続せず、/health は 503 を返します",
		);
		return async () => false;
	}
	const db = deps.createDb(databaseUrl);
	return () => deps.pingDb(db);
}
