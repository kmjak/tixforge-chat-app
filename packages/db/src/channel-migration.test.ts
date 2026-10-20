import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { servers, user } from "./schema";
import { createTestDb, type TestDb } from "./testing";

/** 既にあるサーバーに「一般」を作るマイグレーション（0005）の SQL */
const BACKFILL_SQL = readFileSync(
	resolve(
		__dirname,
		"../migrations/0005_default_channels_for_existing_servers.sql",
	),
	"utf8",
);

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

async function defaultChannels(serverId: string) {
	const { rows } = await db.$client.query<{ name: string; position: number }>(
		"SELECT name, position FROM channels WHERE server_id = $1 AND is_default",
		[serverId],
	);
	return rows;
}

describe("既にあるサーバーに「一般」を作るマイグレーション", () => {
	it("一般 が無いサーバーに、マイグレーションの SQL で 一般 を作れ、二度流しても重複しない", async () => {
		// GT-000011 より前のサーバーの代わりに、channels を作らずにサーバーを直接入れる
		const [owner] = await db
			.insert(user)
			.values({ name: "Owner", email: "backfill@example.com" })
			.returning({ id: user.id });
		if (!owner) throw new Error("user を作れない");
		const [server] = await db
			.insert(servers)
			.values({ name: "Old", ownerUserId: owner.id })
			.returning({ id: servers.id });
		if (!server) throw new Error("サーバーを作れない");
		expect(await defaultChannels(server.id)).toEqual([]);

		await db.$client.exec(BACKFILL_SQL);
		expect(await defaultChannels(server.id)).toEqual([
			{ name: "一般", position: 1 },
		]);

		await db.$client.exec(BACKFILL_SQL);
		expect(await defaultChannels(server.id)).toHaveLength(1);
	});
});
