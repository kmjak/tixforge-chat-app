import { sql } from "drizzle-orm";
import type { Db } from "./client";

/**
 * DB に `SELECT 1` を実行し、成功すれば true を返す。失敗しても例外は投げず、理由をログに出して false を返す。
 * 理由には接続先やユーザー名が含まれることがあるので、ログにだけ出し、呼び出し元の応答には含めない
 */
export async function pingDb(db: Db): Promise<boolean> {
	try {
		await db.execute(sql`select 1`);
		return true;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.error(`DB に接続できません: ${reason}`);
		return false;
	}
}
