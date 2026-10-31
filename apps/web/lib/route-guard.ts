import { resolveRedirect, withRedirect } from "./redirect";

/** ログインせずに開ける画面。これ以外の画面はすべてログインが必要（docs/context/routes.md） */
const PUBLIC_PATHS = new Set(["/", "/sign-in", "/sign-up"]);

/** ログインせずに開ける画面か（ログイン済みなら、これらの画面は別の画面へ移る） */
export function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.has(pathname);
}

/** サインイン・サインアップの画面（ログイン済みなら redirect の先へ移す） */
const AUTH_PATHS = new Set(["/sign-in", "/sign-up"]);

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

/**
 * 開こうとした画面と、ログインしているかから、表示するかリダイレクトするかを決める。
 * docs/context/routes.md「保護する画面の共通の動き」のとおり
 */
export function decideRoute({
	url,
	loggedIn,
}: {
	/** 開こうとした URL */
	url: URL;
	loggedIn: boolean;
}): RouteDecision {
	const { pathname, search, origin } = url;

	if (!loggedIn) {
		if (PUBLIC_PATHS.has(pathname)) {
			return { type: "next" };
		}
		return {
			type: "redirect",
			to: withRedirect("/sign-in", pathname + search),
		};
	}

	if (pathname === "/") {
		return { type: "redirect", to: "/home" };
	}
	if (AUTH_PATHS.has(pathname)) {
		return {
			type: "redirect",
			to: resolveRedirect(url.searchParams.get("redirect"), origin),
		};
	}
	return { type: "next" };
}
