import { sql } from "drizzle-orm";
import type { Db } from "./client";

/** DB に `SELECT 1` を実行し、成功すれば true を返す。失敗しても例外は投げない */
export async function pingDb(db: Db): Promise<boolean> {
	try {
		await db.execute(sql`select 1`);
		return true;
	} catch {
		return false;
	}
}
