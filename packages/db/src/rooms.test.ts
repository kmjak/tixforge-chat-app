import { createChannelService } from "./channels";
import { createProfileService } from "./profiles";
import { listRoomMemberIds } from "./rooms";
import { user } from "./schema";
import { createServerService } from "./servers";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

let seq = 0;

async function insertUser(name: string) {
	seq += 1;
	const [row] = await db
		.insert(user)
		.values({ name, email: `rooms${seq}@example.com` })
		.returning({ id: user.id });
	if (!row) throw new Error("user を作れませんでした");
	const [profile] = await createProfileService(db).list(row.id);
	if (!profile) throw new Error("デフォルトのプロフィールが無い");
	return { userId: row.id, profileId: profile.id };
}

describe("listRoomMemberIds", () => {
	it("チャンネルの部屋は、そのサーバーの今のメンバーだけ。削除したチャンネル・退出したメンバーは含めない", async () => {
		const owner = await insertUser("Owner");
		const member = await insertUser("Member");
		const left = await insertUser("Left");
		const stranger = await insertUser("Stranger");
		const servers = createServerService(db);
		const created = await servers.create(owner.userId, {
			name: "S",
			profileId: owner.profileId,
		});
		if (!created.ok) throw new Error("サーバーを作れない");
		const serverId = created.server.id;
		const invite = await servers.createInvite(owner.userId, serverId, null);
		if (!invite) throw new Error("招待を作れない");
		await servers.join(member.userId, invite.token, member.profileId);
		await servers.join(left.userId, invite.token, left.profileId);
		await db.$client.query(
			"UPDATE server_members SET left_at = now(), profile_id = NULL, left_display_name = 'Left' WHERE user_id = $1",
			[left.userId],
		);
		// 別のサーバーのメンバーは含めない
		await servers.create(stranger.userId, {
			name: "Other",
			profileId: stranger.profileId,
		});
		const channels = createChannelService(db);
		const created2 = await channels.create(owner.userId, serverId, "c");
		if (!created2.ok) throw new Error("チャンネルを作れない");
		const room = { type: "channel", id: created2.channel.id } as const;

		expect((await listRoomMemberIds(db, room)).sort()).toEqual(
			[owner.userId, member.userId].sort(),
		);

		await channels.remove(owner.userId, serverId, created2.channel.id);
		expect(await listRoomMemberIds(db, room)).toEqual([]);
		expect(
			await listRoomMemberIds(db, { type: "channel", id: "not-a-uuid" }),
		).toEqual([]);
	});
});
