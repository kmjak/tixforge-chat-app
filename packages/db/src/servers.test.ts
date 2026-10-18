import { createProfileService } from "./profiles";
import { user } from "./schema";
import { createServerService, generateInviteToken } from "./servers";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

let seq = 0;

/** アカウントを作り、その id とデフォルトのプロフィールの id を返す */
async function insertUser(name = "Me") {
	seq += 1;
	const [row] = await db
		.insert(user)
		.values({ name, email: `servers${seq}@example.com` })
		.returning({ id: user.id });
	if (!row) throw new Error("user を作れませんでした");
	const [profile] = await createProfileService(db).list(row.id);
	if (!profile) throw new Error("デフォルトのプロフィールが無い");
	return { userId: row.id, profileId: profile.id };
}

async function createServer(owner: { userId: string; profileId: string }) {
	const result = await createServerService(db).create(owner.userId, {
		name: "S",
		profileId: owner.profileId,
	});
	if (!result.ok) throw new Error("サーバーを作れない");
	return result.server;
}

/** transaction の中で実行された SQL を記録する（ロックの確認用。profiles.test.ts と同じ） */
function recordTransactionQueries(): string[] {
	const queries: string[] = [];
	const client = db.$client;
	const original = client.transaction.bind(client);
	jest.spyOn(client, "transaction").mockImplementation(((
		callback: (tx: {
			query: (sql: string, ...rest: unknown[]) => unknown;
		}) => unknown,
	) =>
		original(async (tx) => {
			const query = tx.query.bind(tx);
			const recording = (sql: string, ...rest: unknown[]) => {
				queries.push(sql);
				return (query as (...args: unknown[]) => unknown)(sql, ...rest);
			};
			return callback({ ...tx, query: recording } as never);
		})) as never);
	return queries;
}

const LOCK_USER = /select .* from "user" .*for update/i;

afterEach(() => {
	jest.restoreAllMocks();
});

describe("createServerService", () => {
	const s = () => createServerService(db);

	it("作った人がオーナーとして、選んだプロフィールで参加する", async () => {
		const owner = await insertUser("Owner");

		const server = await createServer(owner);

		expect(server).toMatchObject({
			name: "S",
			isOwner: true,
			myProfile: { id: owner.profileId, name: "Owner" },
		});
		expect(await s().list(owner.userId)).toEqual([server]);
		expect(await s().listMembers(owner.userId, server.id)).toEqual([
			{
				profile: { id: owner.profileId, name: "Owner", bio: "" },
				isOwner: true,
				isMe: true,
			},
		]);
	});

	it("他人のプロフィールではサーバーを作れない", async () => {
		const me = await insertUser();
		const other = await insertUser();

		expect(
			await s().create(me.userId, { name: "S", profileId: other.profileId }),
		).toEqual({ ok: false, reason: "invalid-profile" });
		expect(await s().list(me.userId)).toEqual([]);
	});

	it("招待リンクで参加でき、二重には参加しない", async () => {
		const owner = await insertUser("Owner");
		const guest = await insertUser("Guest");
		const server = await createServer(owner);
		const invite = await s().createInvite(owner.userId, server.id, 24);
		if (!invite) throw new Error("招待を作れない");

		expect(await s().findInvite(guest.userId, invite.token)).toMatchObject({
			ok: true,
			invite: { server: { id: server.id, name: "S" }, isMember: false },
		});
		expect(await s().join(guest.userId, invite.token, guest.profileId)).toEqual(
			{
				ok: true,
				serverId: server.id,
				alreadyMember: false,
			},
		);
		expect(await s().join(guest.userId, invite.token, guest.profileId)).toEqual(
			{
				ok: true,
				serverId: server.id,
				alreadyMember: true,
			},
		);
		expect(await s().listMembers(owner.userId, server.id)).toHaveLength(2);
	});

	it("退出した行があれば、その行を戻して再参加する（退出は GT-000010。ここでは SQL で作る）", async () => {
		const owner = await insertUser("Owner");
		const guest = await insertUser("Guest");
		const server = await createServer(owner);
		const invite = await s().createInvite(owner.userId, server.id, null);
		if (!invite) throw new Error("招待を作れない");
		await s().join(guest.userId, invite.token, guest.profileId);
		await db.$client.query(
			"UPDATE server_members SET left_at = now(), left_display_name = 'Guest' WHERE server_id = $1 AND user_id = $2",
			[server.id, guest.userId],
		);
		expect(await s().list(guest.userId)).toEqual([]);
		const sub = await createProfileService(db).create(guest.userId, {
			name: "Again",
			bio: "",
		});
		if (!sub.ok) throw new Error("作れない");

		expect(await s().join(guest.userId, invite.token, sub.profile.id)).toEqual({
			ok: true,
			serverId: server.id,
			alreadyMember: false,
		});
		expect(await s().list(guest.userId)).toEqual([
			expect.objectContaining({
				id: server.id,
				myProfile: { id: sub.profile.id, name: "Again" },
			}),
		]);
		const { rows } = await db.$client.query<{
			left_at: unknown;
			left_display_name: unknown;
		}>(
			"SELECT left_at, left_display_name FROM server_members WHERE server_id = $1 AND user_id = $2",
			[server.id, guest.userId],
		);
		expect(rows).toEqual([{ left_at: null, left_display_name: null }]);
	});

	it("既にメンバーでも、他人のプロフィールを送ったら入力の誤りにする", async () => {
		const owner = await insertUser();
		const server = await createServer(owner);
		const other = await insertUser();
		const invite = await s().createInvite(owner.userId, server.id, null);
		if (!invite) throw new Error("招待を作れない");

		expect(await s().join(owner.userId, invite.token, other.profileId)).toEqual(
			{
				ok: false,
				reason: "invalid-profile",
			},
		);
	});

	it("期限切れ・存在しない招待では参加できない", async () => {
		const owner = await insertUser();
		const guest = await insertUser();
		const server = await createServer(owner);
		const invite = await s().createInvite(owner.userId, server.id, 1);
		if (!invite) throw new Error("招待を作れない");
		await db.$client.query(
			"UPDATE server_invites SET expires_at = now() - interval '1 second' WHERE token = $1",
			[invite.token],
		);

		expect(await s().join(guest.userId, invite.token, guest.profileId)).toEqual(
			{
				ok: false,
				reason: "expired",
			},
		);
		expect(
			await s().join(guest.userId, generateInviteToken(), guest.profileId),
		).toEqual({ ok: false, reason: "not-found" });
		expect(await s().list(guest.userId)).toEqual([]);
	});

	it("サーバーで使用中のプロフィールは使用先に出て消せず、変えると前のものは外れる", async () => {
		const owner = await insertUser("Owner");
		const server = await createServer(owner);
		const profiles = createProfileService(db);
		const sub = await profiles.create(owner.userId, { name: "Sub", bio: "" });
		if (!sub.ok) throw new Error("作れない");

		const changed = await s().changeMyProfile(
			owner.userId,
			server.id,
			sub.profile.id,
		);
		expect(changed).toMatchObject({
			ok: true,
			server: { myProfile: { name: "Sub" } },
		});

		expect(await profiles.listUsages(owner.userId, sub.profile.id)).toEqual([
			{ profileId: sub.profile.id, type: "server", id: server.id, name: "S" },
		]);
		expect(await profiles.remove(owner.userId, sub.profile.id)).toEqual({
			ok: false,
			reason: "in-use",
		});
		expect(await profiles.listUsages(owner.userId, owner.profileId)).toEqual(
			[],
		);
	});

	it("参加していないサーバーは取得・操作できない", async () => {
		const owner = await insertUser();
		const stranger = await insertUser();
		const server = await createServer(owner);

		expect(await s().get(stranger.userId, server.id)).toBeUndefined();
		expect(await s().listMembers(stranger.userId, server.id)).toBeUndefined();
		expect(
			await s().createInvite(stranger.userId, server.id, null),
		).toBeUndefined();
		expect(
			await s().changeMyProfile(stranger.userId, server.id, stranger.profileId),
		).toEqual({ ok: false, reason: "not-found" });
		expect(await s().get(stranger.userId, "not-a-uuid")).toBeUndefined();
	});

	it("作成・参加・プロフィールの変更は、transaction の中で先に user の行をロックする", async () => {
		const owner = await insertUser();
		const guest = await insertUser();
		const queries = recordTransactionQueries();

		const server = await createServer(owner);
		expect(queries[0]).toMatch(LOCK_USER);

		const invite = await s().createInvite(owner.userId, server.id, null);
		if (!invite) throw new Error("招待を作れない");
		queries.length = 0;
		await s().join(guest.userId, invite.token, guest.profileId);
		expect(queries[0]).toMatch(LOCK_USER);

		queries.length = 0;
		await s().changeMyProfile(guest.userId, server.id, guest.profileId);
		expect(queries[0]).toMatch(LOCK_USER);
	});

	it("見る人ごとにメンバーに見せるプロフィールを差し替えられる（GT-000015 のフレンドの判定のため）", async () => {
		const owner = await insertUser("Owner");
		const server = await createServer(owner);
		const custom = createServerService(db, {
			resolveMemberProfiles: async (_db, viewer, members) =>
				new Map(
					members.map((m) => [
						m.userId,
						{
							...m.serverProfile,
							name: `${m.serverProfile.name} for ${viewer === owner.userId ? "owner" : "?"}`,
						},
					]),
				),
		});

		expect(await custom.listMembers(owner.userId, server.id)).toEqual([
			expect.objectContaining({
				profile: expect.objectContaining({ name: "Owner for owner" }),
			}),
		]);
	});
});

describe("generateInviteToken", () => {
	it("32 バイトの base64url（43 文字）で、毎回違う", () => {
		const a = generateInviteToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(generateInviteToken()).not.toBe(a);
	});
});
