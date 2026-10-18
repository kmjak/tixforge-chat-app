import {
	createProfileService,
	findDefaultProfile,
	MAX_PROFILES,
	type ProfileUsageSource,
} from "./profiles";
import { profiles, user } from "./schema";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

let seq = 0;

/** アカウントを作る（trigger でデフォルトのプロフィールもできる） */
async function insertUser(name = "Me"): Promise<string> {
	seq += 1;
	const [row] = await db
		.insert(user)
		.values({ name, email: `user${seq}@example.com` })
		.returning({ id: user.id });
	if (!row) {
		throw new Error("user を作れませんでした");
	}
	return row.id;
}

/**
 * transaction の中で実行された SQL を記録する。PGlite は接続が 1 つで、同時の操作を再現できないので、
 * 代わりに user の行をロックする SQL が実行されることを確かめるために使う
 */
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

async function countDefaults(userId: string): Promise<number> {
	const { rows } = await db.$client.query<{ n: number }>(
		"SELECT count(*)::int AS n FROM profiles WHERE user_id = $1 AND is_default",
		[userId],
	);
	return rows[0]?.n ?? 0;
}

describe("findDefaultProfile", () => {
	it("そのアカウントのデフォルトのプロフィールを返す（デフォルトでないもの・ほかのアカウントのものは返さない）", async () => {
		const userId = await insertUser("Me");
		const otherId = await insertUser("Other");
		await db.insert(profiles).values({ userId, name: "Sub", bio: "sub" });

		expect(await findDefaultProfile(db, userId)).toEqual({
			id: expect.any(String),
			name: "Me",
			bio: "",
		});
		expect(await findDefaultProfile(db, otherId)).toMatchObject({
			name: "Other",
		});
	});

	it("無いアカウントなら undefined を返す", async () => {
		await expect(
			findDefaultProfile(db, "00000000-0000-0000-0000-000000000000"),
		).resolves.toBeUndefined();
	});
});

describe("createProfileService", () => {
	const service = () => createProfileService(db);

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("作成・デフォルトの切り替え・削除は、transaction の中で先に user の行をロックする", async () => {
		const userId = await insertUser();
		const s = service();
		const queries = recordTransactionQueries();

		const created = await s.create(userId, { name: "Lock", bio: "" });
		if (!created.ok) throw new Error("作れない");
		expect(queries[0]).toMatch(LOCK_USER);

		queries.length = 0;
		await s.setDefault(userId, created.profile.id);
		expect(queries[0]).toMatch(LOCK_USER);

		const [, other] = await s.list(userId);
		if (!other) throw new Error("準備できない");
		queries.length = 0;
		await s.remove(userId, other.id);
		expect(queries[0]).toMatch(LOCK_USER);
	});

	it("一覧はデフォルトが先頭で、残りは作った順。ほかのアカウントのものは含まない", async () => {
		const userId = await insertUser("Main");
		const otherId = await insertUser("Other");
		const s = service();
		await s.create(userId, { name: "A", bio: "" });
		await s.create(userId, { name: "B", bio: "b" });
		await s.create(otherId, { name: "X", bio: "" });

		const list = await s.list(userId);

		expect(list.map((p) => [p.name, p.isDefault])).toEqual([
			["Main", true],
			["A", false],
			["B", false],
		]);
	});

	it(`作成は ${MAX_PROFILES} 個まで（デフォルトを含む）`, async () => {
		const userId = await insertUser();
		const s = service();
		for (let i = 1; i < MAX_PROFILES; i++) {
			expect((await s.create(userId, { name: `P${i}`, bio: "" })).ok).toBe(
				true,
			);
		}

		expect(await s.create(userId, { name: "Over", bio: "" })).toEqual({
			ok: false,
			reason: "limit",
		});
		expect(await s.list(userId)).toHaveLength(MAX_PROFILES);
	});

	it("編集は渡した項目だけを変える", async () => {
		const userId = await insertUser();
		const s = service();
		const created = await s.create(userId, { name: "Before", bio: "bio" });
		if (!created.ok) throw new Error("作れない");

		const updated = await s.update(userId, created.profile.id, {
			name: "After",
		});

		expect(updated).toMatchObject({ name: "After", bio: "bio" });
	});

	it("デフォルトを切り替えると、デフォルトは常に 1 つ", async () => {
		const userId = await insertUser("First");
		const s = service();
		const created = await s.create(userId, { name: "Second", bio: "" });
		if (!created.ok) throw new Error("作れない");

		const switched = await s.setDefault(userId, created.profile.id);

		expect(switched).toMatchObject({ name: "Second", isDefault: true });
		expect(await countDefaults(userId)).toBe(1);
		expect(await findDefaultProfile(db, userId)).toMatchObject({
			name: "Second",
		});
		// すでにデフォルトのものを指定しても変わらない
		await s.setDefault(userId, created.profile.id);
		expect(await countDefaults(userId)).toBe(1);
	});

	it("削除：デフォルトは消せず、そうでなければ消せる", async () => {
		const userId = await insertUser();
		const s = service();
		const [def] = await s.list(userId);
		const created = await s.create(userId, { name: "Del", bio: "" });
		if (!def || !created.ok) throw new Error("準備できない");

		expect(await s.remove(userId, def.id)).toEqual({
			ok: false,
			reason: "default",
		});
		expect(await s.remove(userId, created.profile.id)).toEqual({ ok: true });
		expect(await s.get(userId, created.profile.id)).toBeUndefined();
	});

	it("使用中のプロフィールは消せず、使用先の一覧に出る", async () => {
		const userId = await insertUser();
		const s0 = service();
		const used = await s0.create(userId, { name: "Used", bio: "" });
		const free = await s0.create(userId, { name: "Free", bio: "" });
		if (!used.ok || !free.ok) throw new Error("準備できない");
		const usedId = used.profile.id;
		// 割り当ての代わりに、Used をサーバー S で使っていることにする
		const source: ProfileUsageSource = async (_db, profileIds) =>
			profileIds.includes(usedId)
				? [{ profileId: usedId, type: "server", id: "s1", name: "S" }]
				: [];
		const s = createProfileService(db, { usageSources: [source] });

		expect(await s.listUsages(userId, usedId)).toEqual([
			{ profileId: usedId, type: "server", id: "s1", name: "S" },
		]);
		expect(await s.listUsages(userId, free.profile.id)).toEqual([]);
		expect(await s.remove(userId, usedId)).toEqual({
			ok: false,
			reason: "in-use",
		});
		expect(await s.get(userId, usedId)).toBeDefined();
	});

	it("ほかのアカウントのもの・存在しないもの・UUID でない id は、無いものとして扱う", async () => {
		const ownerId = await insertUser("Owner");
		const otherId = await insertUser("Other");
		const s = service();
		const created = await s.create(ownerId, { name: "Mine", bio: "" });
		if (!created.ok) throw new Error("作れない");
		const id = created.profile.id;

		for (const target of [
			id,
			"00000000-0000-0000-0000-000000000000",
			"not-a-uuid",
		]) {
			expect(await s.get(otherId, target)).toBeUndefined();
			expect(
				await s.update(otherId, target, { name: "Hacked" }),
			).toBeUndefined();
			expect(await s.setDefault(otherId, target)).toBeUndefined();
			expect(await s.remove(otherId, target)).toEqual({
				ok: false,
				reason: "not-found",
			});
			expect(await s.listUsages(otherId, target)).toBeUndefined();
		}
		expect(await s.get(ownerId, id)).toMatchObject({ name: "Mine" });
		expect(await countDefaults(otherId)).toBe(1);
	});
});
