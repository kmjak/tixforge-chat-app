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
		console.error(`DB に接続できません: ${describeError(error)}`);
		return false;
	}
}

/**
 * ログに出す理由を 1 行で作る。Drizzle はドライバのエラーを cause に包み、
 * 自分のメッセージ（実行した SQL など、複数行）を付けるので、元のエラーがあればその内容を使う
 */
function describeError(error: unknown): string {
	const source =
		error instanceof Error && error.cause instanceof Error
			? error.cause
			: error;
	return messageOf(source).replace(/\s+/g, " ").trim();
}

/**
 * エラーの内容を取り出す。IPv4・IPv6 の両方に接続を断られたときなどの AggregateError は
 * message が空なので、中の errors の内容を、それも無ければエラーのコードを使う
 */
function messageOf(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	if (error.message) return error.message;
	if (error instanceof AggregateError && error.errors.length > 0) {
		return error.errors.map(messageOf).join(", ");
	}
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : error.name;
}
