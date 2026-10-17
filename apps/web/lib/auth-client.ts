import { createAuthClient } from "better-auth/client";

/**
 * ブラウザから server の認証 API（/api/auth/*）を cookie 付きで呼ぶクライアント。
 * server の URL は NEXT_PUBLIC_SERVER_URL（既定 http://localhost:3001）
 */
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001",
	basePath: "/api/auth",
});
