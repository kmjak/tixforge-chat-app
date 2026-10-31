import {
	createCategoryService,
	createChannelService,
	createDb,
	createProfileService,
	createServerService,
	listRoomMemberIds,
	pingDb,
} from "@chat-app/db";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { readEnv } from "./env";
import { parsePort } from "./port";
import { createRealtimeHub } from "./realtime";

const port = parsePort(process.env.PORT);
const env = readEnv(process.env);
// 接続のプールは 1 つにして、ヘルスチェック・認証・API で共有する
const db = createDb(env.databaseUrl);
const auth = createAuth({
	db,
	secret: env.betterAuthSecret,
	baseURL: env.betterAuthUrl,
	webOrigin: env.webOrigin,
});
const realtime = createRealtimeHub({
	listRoomMemberIds: (room) => listRoomMemberIds(db, room),
	getSession: auth.getSession,
});
realtime.start();
const app = createApp({
	pingDb: () => pingDb(db),
	auth,
	profiles: createProfileService(db),
	servers: createServerService(db),
	channels: createChannelService(db),
	categories: createCategoryService(db),
	realtime,
	webOrigin: env.webOrigin,
});

// WebSocket の upgrade は serve が受け、/api/ws のハンドラ（upgradeWebSocket）に渡す
serve(
	{
		fetch: app.fetch,
		port,
		websocket: { server: new WebSocketServer({ noServer: true }) },
	},
	(info) => {
		console.log(`server listening on http://localhost:${info.port}`);
	},
);
