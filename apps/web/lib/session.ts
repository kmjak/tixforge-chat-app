/** server がセッションを返すまで待つ上限。応答が無ければ未ログインとして扱う */
export const SESSION_TIMEOUT_MS = 5000;

/**
 * リクエストの cookie を付けて server の GET /api/auth/get-session を呼び、ログインしているかを返す。
 * server に届かない・想定外の応答のときは、保護された画面を見せないように未ログインとして扱う
 */
export async function isLoggedIn(
	serverUrl: string,
	cookie: string | null,
): Promise<boolean> {
	if (!cookie) {
		return false;
	}
	try {
		const res = await fetch(`${serverUrl}/api/auth/get-session`, {
			headers: { cookie },
			cache: "no-store",
			signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
		});
		if (!res.ok) {
			return false;
		}
		const body: unknown = await res.json();
		return typeof body === "object" && body !== null && "session" in body;
	} catch {
		return false;
	}
}
