import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * 接続・クエリそれぞれの待ち時間の上限。DB が応答しないときに、ヘルスチェックなどが待ち続けないようにする。
 * 接続とクエリで最大 2 倍かかるので、呼び出し側（web など）はそれより長く待つ
 */
export const DB_TIMEOUT_MS = 2000;

/** 接続文字列から、接続を使い回す（プールする）Drizzle のインスタンスを作る */
export function createDb(databaseUrl: string): Db {
	const pool = new Pool({
		connectionString: databaseUrl,
		connectionTimeoutMillis: DB_TIMEOUT_MS,
		query_timeout: DB_TIMEOUT_MS,
	});
	// 使っていない接続が切れたときのエラーで、プロセスが落ちないようにする
	pool.on("error", (error) => {
		console.error("DB の接続でエラーが起きました:", error.message);
	});
	return drizzle(pool, { schema });
}
