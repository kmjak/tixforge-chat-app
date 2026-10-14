import type { HealthResponse } from "@chat-app/shared";

/** server が応答しないときに、ページの表示を待たせる上限 */
export const HEALTH_TIMEOUT_MS = 3000;

function isHealthResponse(value: unknown): value is HealthResponse {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { status?: unknown }).status === "ok"
	);
}

/** server の状態を取得する。接続できない・タイムアウト・想定外の応答のときは null を返す */
export async function fetchHealth(
	serverUrl: string,
): Promise<HealthResponse | null> {
	try {
		const res = await fetch(`${serverUrl}/health`, {
			cache: "no-store",
			signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const body: unknown = await res.json();
		return isHealthResponse(body) ? body : null;
	} catch {
		return null;
	}
}
