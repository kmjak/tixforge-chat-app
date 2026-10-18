import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ClientErrorStatusCode } from "hono/utils/http-status";

/**
 * API ごとの code を付けて 4xx を返すための例外。onError がエラーの共通形式
 * （docs/context/uri.md）に変える。code は英大文字の SNAKE_CASE
 */
export class ApiError extends HTTPException {
	constructor(
		status: ClientErrorStatusCode,
		readonly code: string,
		message: string,
	) {
		super(status, { message });
	}
}

/** リクエストの本文を JSON として読む。読めなければ 400 BAD_REQUEST */
export async function readJson(c: Context): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		throw new ApiError(400, "BAD_REQUEST", "Malformed JSON");
	}
}
