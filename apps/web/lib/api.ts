/** server の URL（ブラウザから呼ぶとき） */
export const SERVER_URL =
	process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export type ApiResult<T> =
	| { ok: true; data: T }
	/** code は server が返したエラーの code。server に届かないときなどは undefined */
	| { ok: false; code: string | undefined };

/**
 * ブラウザから server の API を cookie 付きで呼ぶ。成功（2xx）なら本文（204 なら null）を返し、
 * 失敗なら server のエラーの code を返す。server に届かないときも例外にせず失敗として返す
 */
export async function callApi<T>(
	path: string,
	{ method = "GET", body }: { method?: string; body?: unknown } = {},
	serverUrl = SERVER_URL,
): Promise<ApiResult<T>> {
	try {
		const res = await fetch(`${serverUrl}${path}`, {
			method,
			credentials: "include",
			headers:
				body === undefined ? undefined : { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (res.ok) {
			const data = res.status === 204 ? null : await res.json();
			return { ok: true, data: data as T };
		}
		return { ok: false, code: await readErrorCode(res) };
	} catch {
		return { ok: false, code: undefined };
	}
}

async function readErrorCode(res: Response): Promise<string | undefined> {
	try {
		const body: unknown = await res.json();
		const code = (body as { code?: unknown } | null)?.code;
		return typeof code === "string" ? code : undefined;
	} catch {
		return undefined;
	}
}
