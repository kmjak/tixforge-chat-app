import { createChannelService } from "./channels";
import { createProfileService } from "./profiles";
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

afterEach(() => {
	jest.restoreAllMocks();
});

let seq = 0;

async function insertUser(name = "Me") {
	seq += 1;
	const [row] = await db
		.insert(user)
		.values({ name, email: `channels${seq}@example.com` })
		.returning({ id: user.id });
	if (!row) throw new Error("user を作れませんでした");
	const [profile] = await createProfileService(db).list(row.id);
	if (!profile) throw new Error("デフォルトのプロフィールが無い");
	return { userId: row.id, profileId: profile.id };
}

/** オーナーとサーバー、招待で参加したメンバーを作る */
async function setup() {
	const owner = await insertUser("Owner");
	const member = await insertUser("Member");
	const servers = createServerService(db);
	const created = await servers.create(owner.userId, {
		name: "S",
		profileId: owner.profileId,
	});
	if (!created.ok) throw new Error("サーバーを作れない");
	const invite = await servers.createInvite(
		owner.userId,
		created.server.id,
		null,
	);
	if (!invite) throw new Error("招待を作れない");
	await servers.join(member.userId, invite.token, member.profileId);
	return { owner, member, serverId: created.server.id };
}

/** transaction の中で実行された SQL を記録する（ロックの確認用） */
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

describe("createChannelService", () => {
	const c = () => createChannelService(db);

	it("サーバーを作ると、既定のチャンネル「一般」が 1 つある", async () => {
		const { owner, serverId } = await setup();

		expect(await c().list(owner.userId, serverId)).toEqual([
			{ id: expect.any(String), name: "一般", isDefault: true },
		]);
	});

	it("作成は作った順に並び、既定を含めて 10 個まで。削除したものは数えない", async () => {
		const { owner, serverId } = await setup();
		for (let i = 2; i <= 10; i++) {
			expect((await c().create(owner.userId, serverId, `c${i}`)).ok).toBe(true);
		}

		expect(await c().create(owner.userId, serverId, "c11")).toEqual({
			ok: false,
			reason: "limit",
		});
		const list = await c().list(owner.userId, serverId);
		expect(list?.map((ch) => ch.name)).toEqual([
			"一般",
			...Array.from({ length: 9 }, (_, i) => `c${i + 2}`),
		]);

		const second = list?.[1];
		if (!second) throw new Error("チャンネルが無い");
		expect(await c().remove(owner.userId, serverId, second.id)).toEqual({
			ok: true,
		});
		expect((await c().create(owner.userId, serverId, "again")).ok).toBe(true);
		// 新しいものは最後に並ぶ
		expect((await c().list(owner.userId, serverId))?.at(-1)?.name).toBe(
			"again",
		);
		// 削除したものは取得できないが、行は deleted_at 付きで残る
		expect(await c().get(owner.userId, serverId, second.id)).toBeUndefined();
		const { rows } = await db.$client.query<{ deleted: boolean }>(
			"SELECT deleted_at IS NOT NULL AS deleted FROM channels WHERE id = $1",
			[second.id],
		);
		expect(rows).toEqual([{ deleted: true }]);
	});

	it("既定のチャンネルは名前を変えられるが、削除できない", async () => {
		const { owner, serverId } = await setup();
		const [general] = (await c().list(owner.userId, serverId)) ?? [];
		if (!general) throw new Error("一般が無い");

		expect(
			await c().rename(owner.userId, serverId, general.id, "lobby"),
		).toEqual({
			ok: true,
			channel: { id: general.id, name: "lobby", isDefault: true },
		});
		expect(await c().remove(owner.userId, serverId, general.id)).toEqual({
			ok: false,
			reason: "default",
		});
	});

	it("メンバーは見られるが操作できず（not-owner）、メンバーでない人は見られない（not-found）", async () => {
		const { owner, member, serverId } = await setup();
		const stranger = await insertUser("Stranger");
		const [general] = (await c().list(owner.userId, serverId)) ?? [];
		if (!general) throw new Error("一般が無い");

		expect(await c().list(member.userId, serverId)).toHaveLength(1);
		expect(await c().create(member.userId, serverId, "x")).toEqual({
			ok: false,
			reason: "not-owner",
		});
		expect(await c().rename(member.userId, serverId, general.id, "x")).toEqual({
			ok: false,
			reason: "not-owner",
		});
		expect(await c().remove(member.userId, serverId, general.id)).toEqual({
			ok: false,
			reason: "not-owner",
		});

		expect(await c().list(stranger.userId, serverId)).toBeUndefined();
		expect(
			await c().get(stranger.userId, serverId, general.id),
		).toBeUndefined();
		expect(await c().create(stranger.userId, serverId, "x")).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await c().list(owner.userId, "not-a-uuid")).toBeUndefined();
		expect(await c().get(owner.userId, serverId, "not-a-uuid")).toBeUndefined();
	});

	it("作成は、transaction の中で先に servers の行をロックしてから数える", async () => {
		const { owner, serverId } = await setup();
		const queries = recordTransactionQueries();

		await c().create(owner.userId, serverId, "locked");

		expect(queries[0]).toMatch(/select .* from "servers" .*for update/i);
	});
});
