import { type ErrorResponse, WS_PATH } from "@chat-app/shared";
import { upgradeWebSocket } from "@hono/node-server";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import type { RealtimeHub } from "./realtime";

/**
 * WebSocket の接続の口（docs/context/ws.md）。/api の下なので、ログイン確認の middleware を通った後
 * （未ログインは 401）。WebSocket には CORS が効かないので、Origin が web でなければ 403 にする
 * （他のサイトが、ログイン中の cookie で接続するのを防ぐ）
 */
export function registerWebSocketRoute(
	app: Hono<AppEnv>,
	{ realtime, webOrigin }: { realtime: RealtimeHub; webOrigin: string },
): void {
	app.get(
		WS_PATH,
		async (c, next) => {
			if (c.req.header("origin") !== webOrigin) {
				return c.json<ErrorResponse>(
					{ code: "FORBIDDEN", message: "Origin not allowed" },
					403,
				);
			}
			await next();
		},
		upgradeWebSocket((c) => {
			const user = c.get("user");
			const sessionId = c.get("sessionId");
			// セッションを確かめ直すため、cookie だけを持っておく
			const headers = new Headers({ cookie: c.req.header("cookie") ?? "" });
			return {
				onOpen: (_event, ws) => {
					realtime.connect({ userId: user.id, sessionId, headers, ws });
				},
				onClose: (_event, ws) => {
					realtime.disconnect(ws);
				},
			};
		}),
	);
}
