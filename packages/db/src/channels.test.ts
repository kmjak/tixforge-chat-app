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

	it("別のサーバーのチャンネルは、そのサーバーのオーナーでも取得・名前の変更・削除できない（not-found）", async () => {
		const a = await setup();
		const b = await setup();
		const other = await c().create(b.owner.userId, b.serverId, "other");
		if (!other.ok) throw new Error("チャンネルを作れない");
		// a のオーナーが、自分のサーバー a の id と、b のチャンネルの id を組み合わせる
		const otherId = other.channel.id;

		expect(await c().get(a.owner.userId, a.serverId, otherId)).toBeUndefined();
		expect(await c().rename(a.owner.userId, a.serverId, otherId, "x")).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await c().remove(a.owner.userId, a.serverId, otherId)).toEqual({
			ok: false,
			reason: "not-found",
		});
		expect(await c().get(b.owner.userId, b.serverId, otherId)).toEqual(
			other.channel,
		);
	});

	it.each([
		[
			"作成は、transaction の中で先に servers の行をロックしてから数える",
			"create",
		],
		[
			"名前の変更は、transaction の中で先に servers の行をロックしてからオーナーを確かめる",
			"rename",
		],
		[
			"削除は、transaction の中で先に servers の行をロックしてからオーナーを確かめる",
			"remove",
		],
		[
			"並び順の保存は、transaction の中で先に servers の行をロックしてからオーナーを確かめる",
			"saveLayout",
		],
	] as const)("%s", async (_, operation) => {
		const { owner, serverId } = await setup();
		const created = await c().create(owner.userId, serverId, "target");
		if (!created.ok) throw new Error("チャンネルを作れない");
		const queries = recordTransactionQueries();

		if (operation === "create") {
			await c().create(owner.userId, serverId, "locked");
		} else if (operation === "rename") {
			await c().rename(owner.userId, serverId, created.channel.id, "renamed");
		} else if (operation === "remove") {
			await c().remove(owner.userId, serverId, created.channel.id);
		} else {
			await c().saveLayout(owner.userId, serverId, {
				channels: [created.channel.id],
				categories: [],
			});
		}

		expect(queries[0]).toMatch(/select .* from "servers" .*for update/i);
	});

	describe("カテゴリと並び順", () => {
		const cat = () => createCategoryService(db);

		async function createCategory(
			userId: string,
			serverId: string,
			name: string,
		) {
			const created = await cat().create(userId, serverId, name);
			if (!created.ok) throw new Error("カテゴリを作れない");
			return created.category.id;
		}

		async function createIn(
			userId: string,
			serverId: string,
			name: string,
			categoryId: string | null,
		) {
			const created = await c().create(userId, serverId, name, categoryId);
			if (!created.ok)
				throw new Error(`チャンネルを作れない：${created.reason}`);
			return created.channel;
		}

		const names = (channels: { name: string }[] | undefined) =>
			channels?.map((channel) => channel.name);

		it("カテゴリを選んで作ると、その並びの末尾に入り、並びごとに 10 個まで", async () => {
			const { owner, serverId } = await setup();
			const k = await createCategory(owner.userId, serverId, "k");
			for (let i = 1; i <= 10; i++) {
				await createIn(owner.userId, serverId, `k${i}`, k);
			}

			expect(await c().create(owner.userId, serverId, "k11", k)).toEqual({
				ok: false,
				reason: "limit",
			});
			// カテゴリに属さない並びは別に数える
			await createIn(owner.userId, serverId, "top", null);
			const layout = await c().layout(owner.userId, serverId);
			expect(names(layout?.channels)).toEqual(["一般", "top"]);
			expect(names(layout?.categories[0]?.channels)).toEqual(
				Array.from({ length: 10 }, (_, i) => `k${i + 1}`),
			);
		});

		it("削除した・別のサーバーの・UUID の形でないカテゴリには作れない（invalid-category）", async () => {
			const { owner, serverId } = await setup();
			const other = await setup();
			const removed = await createCategory(owner.userId, serverId, "gone");
			await cat().remove(owner.userId, serverId, removed);
			const others = await createCategory(
				other.owner.userId,
				other.serverId,
				"other",
			);

			for (const categoryId of [removed, others, "not-a-uuid"]) {
				expect(
					await c().create(owner.userId, serverId, "x", categoryId),
				).toEqual({ ok: false, reason: "invalid-category" });
			}
			expect(await c().list(owner.userId, serverId)).toHaveLength(1);
		});

		it("並び順の保存で、順を振り直し、カテゴリに入れる・出す・移すことができる", async () => {
			const { owner, member, serverId } = await setup();
			const a = await createCategory(owner.userId, serverId, "a");
			const b = await createCategory(owner.userId, serverId, "b");
			const [general] = (await c().list(owner.userId, serverId)) ?? [];
			if (!general) throw new Error("一般が無い");
			const top = await createIn(owner.userId, serverId, "top", null);
			const inA = await createIn(owner.userId, serverId, "in-a", a);
			const inB = await createIn(owner.userId, serverId, "in-b", b);

			// top を a に入れ、in-a を出し、in-b を a に移し、カテゴリの順を b → a にする
			const saved = await c().saveLayout(owner.userId, serverId, {
				channels: [inA.id, general.id],
				categories: [
					{ id: b, channels: [] },
					{ id: a, channels: [inB.id, top.id] },
				],
			});

			const expected = {
				channels: [inA, general],
				categories: [
					{ id: b, name: "b", channels: [] },
					{ id: a, name: "a", channels: [inB, top] },
				],
			};
			expect(saved).toEqual({ ok: true, layout: expected });
			// メンバーにも同じ順で見える
			expect(await c().layout(member.userId, serverId)).toEqual(expected);
			// 新しく作ったものは、その並びの末尾に入る
			await createIn(owner.userId, serverId, "last", a);
			expect(
				names(
					(await c().layout(owner.userId, serverId))?.categories[1]?.channels,
				),
			).toEqual(["in-b", "top", "last"]);
		});

		it("並び順の保存は、今の集まりと違えば outdated、重複・形が違えば invalid、並びが上限を超えれば limit で、何も変えない", async () => {
			const { owner, member, serverId } = await setup();
			const k = await createCategory(owner.userId, serverId, "k");
			const [general] = (await c().list(owner.userId, serverId)) ?? [];
			if (!general) throw new Error("一般が無い");
			const tops: string[] = [general.id];
			for (let i = 2; i <= 10; i++) {
				tops.push((await createIn(owner.userId, serverId, `t${i}`, null)).id);
			}
			const inK = await createIn(owner.userId, serverId, "in-k", k);
			const before = await c().layout(owner.userId, serverId);

			const cases = [
				// 今あるチャンネルが足りない（別の画面で作った後の古い並び）
				[{ channels: tops, categories: [{ id: k, channels: [] }] }, "outdated"],
				// 今あるカテゴリが足りない
				[{ channels: [...tops, inK.id], categories: [] }, "outdated"],
				// 知らない id がある
				[
					{
						channels: tops,
						categories: [{ id: k, channels: [inK.id, crypto.randomUUID()] }],
					},
					"outdated",
				],
				// 同じ id が 2 回ある
				[
					{
						channels: tops,
						categories: [{ id: k, channels: [inK.id, inK.id] }],
					},
					"invalid",
				],
				// UUID の形でない
				[
					{ channels: tops, categories: [{ id: k, channels: ["x"] }] },
					"invalid",
				],
				// カテゴリに属さない並びが 11 個になる
				[
					{
						channels: [...tops, inK.id],
						categories: [{ id: k, channels: [] }],
					},
					"limit",
				],
			] as const;
			for (const [input, reason] of cases) {
				expect(
					await c().saveLayout(owner.userId, serverId, {
						channels: [...input.channels],
						categories: input.categories.map((category) => ({
							id: category.id,
							channels: [...category.channels],
						})),
					}),
				).toEqual({ ok: false, reason });
			}
			expect(
				await c().saveLayout(member.userId, serverId, {
					channels: tops,
					categories: [{ id: k, channels: [inK.id] }],
				}),
			).toEqual({ ok: false, reason: "not-owner" });
			expect(await c().layout(owner.userId, serverId)).toEqual(before);
		});
	});
});
