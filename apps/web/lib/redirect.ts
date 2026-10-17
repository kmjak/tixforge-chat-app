/** ログイン後に移る先の既定値（redirect が無い・受け付けないとき） */
export const DEFAULT_AFTER_SIGN_IN = "/home";

/** 制御文字（タブ・改行など）と空白 */
const CONTROL_OR_SPACE = /[\p{Cc}\s]/u;

/**
 * redirect の query を、移ってよい先なら返し、そうでなければ /home を返す。
 * 外部のサイトへ移されないように、docs/context/routes.md「保護する画面の共通の動き」の
 * 条件をすべて満たすときだけ受け付ける
 */
export function resolveRedirect(
	redirect: string | null | undefined,
	origin: string,
): string {
	if (
		!redirect?.startsWith("/") ||
		redirect.startsWith("//") ||
		redirect.includes("\\") ||
		CONTROL_OR_SPACE.test(redirect)
	) {
		return DEFAULT_AFTER_SIGN_IN;
	}
	try {
		if (new URL(redirect, origin).origin !== new URL(origin).origin) {
			return DEFAULT_AFTER_SIGN_IN;
		}
	} catch {
		return DEFAULT_AFTER_SIGN_IN;
	}
	return redirect;
}

/** サインイン・サインアップの画面のパスに、受け取った redirect を付ける（無ければ付けない） */
export function withRedirect(
	path: "/sign-in" | "/sign-up",
	redirect: string | null | undefined,
): string {
	return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
