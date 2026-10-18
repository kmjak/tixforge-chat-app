/**
 * web の server 側（ページの表示）から server の API を呼ぶときの待ち時間の上限。
 * server が DB への接続とクエリで最大 12 秒（packages/db の DB_MAX_WAIT_MS）待つので、それより長くする
 */
export const SERVER_API_TIMEOUT_MS = 15_000;

export type ServerGetResult<T> =
	| { ok: true; data: T }
	| { ok: false; status: number };

/**
 * ページを表示するときに、ブラウザから来た cookie を付けて server の API を GET する。
 * 404 などはステータスを返し、ページ側で notFound() などに変える。server に届かないときは例外
 */
export async function serverGet<T>(
	serverUrl: string,
	path: string,
	cookie: string,
): Promise<ServerGetResult<T>> {
	const res = await fetch(`${serverUrl}${path}`, {
		headers: { cookie },
		cache: "no-store",
		signal: AbortSignal.timeout(SERVER_API_TIMEOUT_MS),
	});
	if (!res.ok) {
		return { ok: false, status: res.status };
	}
	return { ok: true, data: (await res.json()) as T };
}
