import { type NextRequest, NextResponse } from "next/server";
import { decideRoute } from "./lib/route-guard";
import { isLoggedIn } from "./lib/session";

const serverUrl = process.env.SERVER_URL ?? "http://localhost:3001";

/**
 * 画面を表示する前に、ログインしているかで振り分ける（docs/context/routes.md「保護する画面の共通の動き」）。
 * 公開の画面以外はすべてログインが必要なので、新しい画面も何もしなければ保護される
 */
export async function proxy(request: NextRequest) {
	const decision = decideRoute({
		url: request.nextUrl,
		loggedIn: await isLoggedIn(serverUrl, request.headers.get("cookie")),
	});
	if (decision.type === "redirect") {
		return NextResponse.redirect(new URL(decision.to, request.url));
	}
	return NextResponse.next();
}

export const config = {
	// Next.js の静的ファイル・画像と、拡張子の付いたファイル（favicon.ico など）は対象外
	matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
