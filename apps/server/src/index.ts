import { createDb, pingDb } from "@chat-app/db";
import { serve } from "@hono/node-server";
import { type AppDeps, createApp } from "./app";
import { parsePort } from "./port";

const port = parsePort(process.env.PORT);

function createPingDb(databaseUrl: string | undefined): AppDeps["pingDb"] {
	if (!databaseUrl?.trim()) {
		console.warn(
			"DATABASE_URL が設定されていません。DB には接続せず、/health は 503 を返します",
		);
		return async () => false;
	}
	const db = createDb(databaseUrl);
	return () => pingDb(db);
}

const app = createApp({ pingDb: createPingDb(process.env.DATABASE_URL) });

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`server listening on http://localhost:${info.port}`);
});
