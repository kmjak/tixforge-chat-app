import type { HealthResponse } from "@chat-app/shared";

/**
 * server が応答しないときに、ページの表示を待たせる上限。
 * server の /health は DB の確かめに最大約 4 秒かかるので、それより長くする
 */
export const HEALTH_TIMEOUT_MS = 5000;

/** server が返す 2 つの形（200 で ok、503 で DB の error）のどちらかか */
function isHealthResponse(
	status: number,
	value: unknown,
): value is HealthResponse {
	if (typeof value !== "object" || value === null) return false;
	const body = value as { status?: unknown; db?: unknown };
	if (status === 200) return body.status === "ok" && body.db === "ok";
	if (status === 503) return body.status === "error" && body.db === "error";
	return false;
}

/**
 * server の状態を取得する。server には届いたが DB が使えないときは、DB の error の応答を返す。
 * server に届かない・タイムアウト・想定外の応答のときは null を返す
 */
export async function fetchHealth(
	serverUrl: string,
): Promise<HealthResponse | null> {
	try {
		const res = await fetch(`${serverUrl}/health`, {
			cache: "no-store",
			signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
		});
		const body: unknown = await res.json();
		return isHealthResponse(res.status, body) ? body : null;
	} catch {
		return null;
	}
}
