import { createDb, createProfileService, pingDb } from "@chat-app/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { readEnv } from "./env";
import { parsePort } from "./port";

const port = parsePort(process.env.PORT);
const env = readEnv(process.env);
// 接続のプールは 1 つにして、ヘルスチェック・認証・API で共有する
const db = createDb(env.databaseUrl);
const app = createApp({
	pingDb: () => pingDb(db),
	auth: createAuth({
		db,
		secret: env.betterAuthSecret,
		baseURL: env.betterAuthUrl,
		webOrigin: env.webOrigin,
	}),
	profiles: createProfileService(db),
	webOrigin: env.webOrigin,
});

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`server listening on http://localhost:${info.port}`);
});
