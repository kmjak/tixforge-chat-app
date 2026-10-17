import { createDb } from "@chat-app/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createPingDb } from "./db-ping";
import { readEnv } from "./env";
import { parsePort } from "./port";

const port = parsePort(process.env.PORT);
const env = readEnv(process.env);
const app = createApp({
	pingDb: createPingDb(env.databaseUrl),
	auth: createAuth({
		db: createDb(env.databaseUrl),
		secret: env.betterAuthSecret,
		baseURL: env.betterAuthUrl,
		webOrigin: env.webOrigin,
	}),
	webOrigin: env.webOrigin,
});

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`server listening on http://localhost:${info.port}`);
});
