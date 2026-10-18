import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/** node-postgres（本番）と PGlite（テスト）のどちらの Drizzle でも受け取れる型 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * 接続の待ち時間の上限。Neon（シンガポール）への TLS と認証で 1〜2 秒、止まっていた DB の起動
 * （scale to zero）でさらに数秒かかることがあるので、余裕を持たせる
 */
export const DB_CONNECT_TIMEOUT_MS = 10_000;

/** 1 回のクエリの待ち時間の上限。DB が応答しないときに、ヘルスチェックなどが待ち続けないようにする */
export const DB_QUERY_TIMEOUT_MS = 2000;

/**
 * 接続とクエリで最大これだけかかる。呼び出し側（web など）は、これより長く待つ
 */
export const DB_MAX_WAIT_MS = DB_CONNECT_TIMEOUT_MS + DB_QUERY_TIMEOUT_MS;

/**
 * 使っていない接続を閉じるまでの時間。pg の既定（10 秒）だと、少し間が空くたびに
 * 時間のかかる接続をし直すことになるので、長めにする
 */
const DB_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** 接続文字列から、接続を使い回す（プールする）Drizzle のインスタンスを作る */
export function createDb(databaseUrl: string): Db {
	const pool = new Pool({
		connectionString: databaseUrl,
		connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
		query_timeout: DB_QUERY_TIMEOUT_MS,
		idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
	});
	// 使っていない接続が切れたときのエラーで、プロセスが落ちないようにする
	pool.on("error", (error) => {
		console.error("DB の接続でエラーが起きました:", error.message);
	});
	return drizzle(pool, { schema });
}
