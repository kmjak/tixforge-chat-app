import { MESSAGE_PAGE_SIZE } from "@chat-app/shared";
import { createChannelService } from "./channels";
import { createMessageService } from "./messages";
import { createProfileService } from "./profiles";
import { user } from "./schema";
import { createServerService, type MemberProfileResolver } from "./servers";
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
		.values({ name, email: `messages${seq}@example.com` })
		.returning({ id: user.id });
	if (!row) throw new Error("user を作れませんでした");
	const [profile] = await createProfileService(db).list(row.id);
	if (!profile) throw new Error("デフォルトのプロフィールが無い");
	return { userId: row.id, profileId: profile.id, profileName: profile.name };
}

/** オーナー・招待で参加したメンバーとサーバー、既定のチャンネル */
async function setup() {
	const owner = await insertUser("Owner");
	const member = await insertUser("Member");
	const servers = createServerService(db);
	const created = await servers.create(owner.userId, {
		name: "S",
		profileId: owner.profileId,
	});
	if (!created.ok) throw new Error("サーバーを作れない");
	const serverId = created.server.id;
	const invite = await servers.createInvite(owner.userId, serverId, null);
	if (!invite) throw new Error("招待を作れない");
	const joined = await servers.join(
		member.userId,
		invite.token,
		member.profileId,
	);
	if (!joined.ok) throw new Error("参加できない");
	const layout = await createChannelService(db).layout(owner.userId, serverId);
	const general = layout?.channels[0];
	if (!general) throw new Error("一般が無い");
	return {
		owner,
		member,
		serverId,
		channelId: general.id,
		invite: invite.token,
		joinMessageId: joined.joinMessageId,
	};
}

describe("createMessageService", () => {
	const m = () => createMessageService(db);

	it("送ったメッセージが、送り手のサーバーのプロフィールで新しい順に並ぶ", async () => {
		const { owner, member, serverId, channelId } = await setup();

		const first = await m().send(owner.userId, serverId, channelId, "1 通目");
		const second = await m().send(member.userId, serverId, channelId, "2 通目");
		expect(first.ok && second.ok).toBe(true);

		const page = await m().list(member.userId, serverId, channelId);
		expect(page?.hasMore).toBe(false);
		expect(page?.messages.map((x) => [x.kind, x.body, x.sender.name])).toEqual([
			["text", "2 通目", "Member"],
			["text", "1 通目", "Owner"],
			["join", null, "Member"],
		]);
		expect(page?.messages[0]?.sender).toEqual({
			id: member.profileId,
			name: "Member",
		});
	});

	it("50 件ずつ、before より古いものをさかのぼれる", async () => {
		const { owner, serverId, channelId } = await setup();
		for (let i = 1; i <= 120; i++) {
			await m().send(owner.userId, serverId, channelId, `m${i}`);
		}

		const first = await m().list(owner.userId, serverId, channelId);
		expect(first?.messages).toHaveLength(MESSAGE_PAGE_SIZE);
		expect(first?.messages[0]?.body).toBe("m120");
		expect(first?.hasMore).toBe(true);

		const second = await m().list(
			owner.userId,
			serverId,
			channelId,
			first?.messages.at(-1)?.id,
		);
		expect(second?.messages[0]?.body).toBe("m70");
		expect(second?.hasMore).toBe(true);

		const third = await m().list(
			owner.userId,
			serverId,
			channelId,
			second?.messages.at(-1)?.id,
		);
		// 残り 20 件と、オーナーが作ったときには無い参加のメッセージ（メンバーの参加の 1 件）
		expect(third?.messages.map((x) => x.body)).toEqual([
			...Array.from({ length: 20 }, (_, i) => `m${20 - i}`),
			null,
		]);
		expect(third?.hasMore).toBe(false);
	});

	it("メンバーでない・削除した・別のサーバーのチャンネルでは、取得・送信できない", async () => {
		const { owner, serverId, channelId } = await setup();
		const other = await setup();
		const stranger = await insertUser("Stranger");
		const created = await createChannelService(db).create(
			owner.userId,
			serverId,
			"gone",
		);
		if (!created.ok) throw new Error("チャンネルを作れない");
		await m().send(owner.userId, serverId, created.channel.id, "消える前");
		await createChannelService(db).remove(
			owner.userId,
			serverId,
			created.channel.id,
		);

		for (const [who, sid, cid] of [
			[stranger.userId, serverId, channelId],
			[owner.userId, serverId, created.channel.id],
			// 自分がメンバーのサーバーと、別のサーバーのチャンネルを組み合わせる
			[owner.userId, serverId, other.channelId],
			[owner.userId, serverId, "not-a-uuid"],
		] as const) {
			expect(await m().list(who, sid, cid)).toBeUndefined();
			expect(await m().send(who, sid, cid, "x")).toEqual({
				ok: false,
				reason: "not-found",
			});
		}
	});

	it("送り手がプロフィールを変えると、過去のメッセージもそのプロフィールで表示される。退出した人は（退出済み）", async () => {
		const { owner, member, serverId, channelId } = await setup();
		await m().send(member.userId, serverId, channelId, "hello");
		const created = await createProfileService(db).create(member.userId, {
			name: "Renamed",
			bio: "",
		});
		if (!created.ok) throw new Error("プロフィールを作れない");
		await createServerService(db).changeMyProfile(
			member.userId,
			serverId,
			created.profile.id,
		);

		const page = await m().list(owner.userId, serverId, channelId);
		expect(page?.messages[0]?.sender).toEqual({
			id: created.profile.id,
			name: "Renamed",
		});

		// 退出（GT-000010 の API は無いので、DB で退出した状態にする）
		await db.$client.query(
			"UPDATE server_members SET left_at = now(), profile_id = NULL, left_display_name = 'Renamed' WHERE user_id = $1",
			[member.userId],
		);
		const after = await m().list(owner.userId, serverId, channelId);
		expect(after?.messages[0]?.sender).toEqual({
			id: null,
			name: "Renamed（退出済み）",
		});
	});

	it("見る人ごとの表示（resolveMemberProfiles）を通す", async () => {
		const { owner, member, serverId, channelId } = await setup();
		await m().send(member.userId, serverId, channelId, "hello");
		const resolver: MemberProfileResolver = async (_db, viewer, members) =>
			new Map(
				members.map((x) => [
					x.userId,
					{
						...x.serverProfile,
						name: `${x.serverProfile.name} for ${viewer === owner.userId ? "owner" : "other"}`,
					},
				]),
			);

		const page = await createMessageService(db, {
			resolveMemberProfiles: resolver,
		}).list(owner.userId, serverId, channelId);

		expect(page?.messages[0]?.sender.name).toBe("Member for owner");
	});

	it("サーバーに参加すると、既定のチャンネルに参加のメッセージが入る。既にメンバーなら入らない", async () => {
		const { owner, member, serverId, channelId, invite, joinMessageId } =
			await setup();

		expect(joinMessageId).toEqual(expect.any(Number));
		const broadcast = joinMessageId
			? await m().findForBroadcast(joinMessageId)
			: undefined;
		expect(broadcast).toEqual({
			channelId,
			message: {
				id: joinMessageId,
				kind: "join",
				body: null,
				sender: { id: member.profileId, name: "Member" },
				createdAt: expect.any(Date),
			},
		});

		const again = await createServerService(db).join(
			member.userId,
			invite,
			member.profileId,
		);
		expect(again).toEqual({ ok: true, serverId, alreadyMember: true });
		const page = await m().list(owner.userId, serverId, channelId);
		expect(page?.messages.filter((x) => x.kind === "join")).toHaveLength(1);
	});
});
