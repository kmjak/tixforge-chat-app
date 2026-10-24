import { createCategoryService } from "./categories";
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
		.values({ name, email: `categories${seq}@example.com` })
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

describe("createCategoryService", () => {
	const cat = () => createCategoryService(db);
	const ch = () => createChannelService(db);

	it("作成は作った順に並び、5 個まで。削除したものは数えない", async () => {
		const { owner, serverId } = await setup();
		const ids: string[] = [];
		for (let i = 1; i <= 5; i++) {
			const created = await cat().create(owner.userId, serverId, `k${i}`);
			if (!created.ok) throw new Error("カテゴリを作れない");
			ids.push(created.category.id);
		}

		expect(await cat().create(owner.userId, serverId, "k6")).toEqual({
			ok: false,
			reason: "limit",
		});
		const layout = await ch().layout(owner.userId, serverId);
		expect(layout?.categories.map((k) => k.name)).toEqual([
			"k1",
			"k2",
			"k3",
			"k4",
			"k5",
		]);

		const [first] = ids;
		if (!first) throw new Error("カテゴリが無い");
		expect(await cat().remove(owner.userId, serverId, first)).toEqual({
			ok: true,
		});
		expect((await cat().create(owner.userId, serverId, "again")).ok).toBe(true);
		expect(
			(await ch().layout(owner.userId, serverId))?.categories.at(-1)?.name,
		).toBe("again");
	});

	it("削除すると、中のチャンネルも論理削除され、カテゴリに属さない並びは残る", async () => {
		const { owner, serverId } = await setup();
		const created = await cat().create(owner.userId, serverId, "k");
		if (!created.ok) throw new Error("カテゴリを作れない");
		const inside = await ch().create(
			owner.userId,
			serverId,
			"inside",
			created.category.id,
		);
		if (!inside.ok) throw new Error("チャンネルを作れない");

		expect(
			await cat().remove(owner.userId, serverId, created.category.id),
		).toEqual({ ok: true });

		expect(await ch().layout(owner.userId, serverId)).toEqual({
			channels: [{ id: expect.any(String), name: "一般", isDefault: true }],
			categories: [],
		});
		expect(
			await ch().get(owner.userId, serverId, inside.channel.id),
		).toBeUndefined();
		const { rows } = await db.$client.query<{ deleted: boolean }>(
			"SELECT deleted_at IS NOT NULL AS deleted FROM channels WHERE id = $1",
			[inside.channel.id],
		);
		expect(rows).toEqual([{ deleted: true }]);
		// 削除したカテゴリは、名前の変更・削除も not-found
		expect(
			await cat().rename(owner.userId, serverId, created.category.id, "x"),
		).toEqual({ ok: false, reason: "not-found" });
	});

	it("既定のチャンネルが入っているカテゴリは削除できない", async () => {
		const { owner, serverId } = await setup();
		const created = await cat().create(owner.userId, serverId, "k");
		if (!created.ok) throw new Error("カテゴリを作れない");
		const layout = await ch().layout(owner.userId, serverId);
		const general = layout?.channels[0];
		if (!general) throw new Error("一般が無い");
		const moved = await ch().saveLayout(owner.userId, serverId, {
			channels: [],
			categories: [{ id: created.category.id, channels: [general.id] }],
		});
		expect(moved.ok).toBe(true);

		expect(
			await cat().remove(owner.userId, serverId, created.category.id),
		).toEqual({ ok: false, reason: "has-default" });
		expect(
			(await ch().layout(owner.userId, serverId))?.categories[0]?.channels,
		).toEqual([general]);
	});

	it("メンバーは操作できず（not-owner）、メンバーでない人・別のサーバーのカテゴリは not-found", async () => {
		const { owner, member, serverId } = await setup();
		const other = await setup();
		const stranger = await insertUser("Stranger");
		const created = await cat().create(owner.userId, serverId, "k");
		if (!created.ok) throw new Error("カテゴリを作れない");
		const id = created.category.id;

		expect(await cat().create(member.userId, serverId, "x")).toEqual({
			ok: false,
			reason: "not-owner",
		});
		expect(await cat().rename(member.userId, serverId, id, "x")).toEqual({
			ok: false,
			reason: "not-owner",
		});
		expect(await cat().remove(member.userId, serverId, id)).toEqual({
			ok: false,
			reason: "not-owner",
		});
		expect(await cat().create(stranger.userId, serverId, "x")).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await cat().rename(stranger.userId, serverId, id, "x")).toEqual({
			ok: false,
			reason: "not-found",
		});
		// 自分がオーナーの別のサーバーの URL と組み合わせても扱えない
		expect(
			await cat().rename(other.owner.userId, other.serverId, id, "x"),
		).toEqual({ ok: false, reason: "not-found" });
		expect(await cat().remove(other.owner.userId, other.serverId, id)).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(
			await cat().rename(owner.userId, serverId, "not-a-uuid", "x"),
		).toEqual({ ok: false, reason: "not-found" });
		expect((await ch().layout(owner.userId, serverId))?.categories).toEqual([
			{ id, name: "k", channels: [] },
		]);
	});

	it.each([
		["作成", "create"],
		["名前の変更", "rename"],
		["削除", "remove"],
	] as const)(
		"%sは、transaction の中で先に servers の行をロックする",
		async (_, operation) => {
			const { owner, serverId } = await setup();
			const created = await cat().create(owner.userId, serverId, "target");
			if (!created.ok) throw new Error("カテゴリを作れない");
			const queries = recordTransactionQueries();

			if (operation === "create") {
				await cat().create(owner.userId, serverId, "locked");
			} else if (operation === "rename") {
				await cat().rename(owner.userId, serverId, created.category.id, "r");
			} else {
				await cat().remove(owner.userId, serverId, created.category.id);
			}

			expect(queries[0]).toMatch(/select .* from "servers" .*for update/i);
		},
	);
});
