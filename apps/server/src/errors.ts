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

/**
 * リクエストの本文を JSON として読む。Content-Type が application/json でなければ
 * 415 UNSUPPORTED_MEDIA_TYPE、読めなければ 400 BAD_REQUEST。
 * JSON の本文はブラウザのプリフライトが必要になるので、CORS（WEB_ORIGIN だけ許可）で
 * 別の origin からの呼び出し（CSRF）が止まる。text/plain などの「単純リクエスト」は通さない
 */
export async function readJson(c: Context): Promise<unknown> {
	const contentType = c.req.header("Content-Type") ?? "";
	if (!/^application\/json(\s*;|$)/i.test(contentType)) {
		throw new ApiError(
			415,
			"UNSUPPORTED_MEDIA_TYPE",
			"Content-Type must be application/json",
		);
	}
	try {
		return await c.req.json();
	} catch {
		throw new ApiError(400, "BAD_REQUEST", "Malformed JSON");
	}
}
