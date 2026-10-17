import { eq } from "drizzle-orm";
import { profiles, user } from "./schema";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

/** アカウントを 1 つ作り、その id を返す（trigger でデフォルトのプロフィールもできる） */
async function insertUser(email: string, name = "Taro"): Promise<string> {
	const [row] = await db
		.insert(user)
		.values({ name, email })
		.returning({ id: user.id });
	if (!row) {
		throw new Error("user を作れませんでした");
	}
	return row.id;
}

describe("プロフィールのテーブルが schema.md の制約どおり", () => {
	it("アカウントを作ると、その name でデフォルトのプロフィールが 1 つでき、bio は空になる", async () => {
		const userId = await insertUser("default@example.com", "Hanako");

		const rows = await db
			.select()
			.from(profiles)
			.where(eq(profiles.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			name: "Hanako",
			bio: "",
			isDefault: true,
		});
	});

	it("bio・is_default を省くと、空文字・false になる", async () => {
		const userId = await insertUser("defaults@example.com");

		const [row] = await db
			.insert(profiles)
			.values({ userId, name: "Sub" })
			.returning();
		expect(row).toMatchObject({ bio: "", isDefault: false });
	});

	it("デフォルトのプロフィールは、1 つのアカウントに 1 つまで", async () => {
		const userId = await insertUser("unique@example.com");

		await expect(
			db.insert(profiles).values({ userId, name: "Second", isDefault: true }),
		).rejects.toThrow();
	});

	it("デフォルトでないプロフィールは、同じアカウントに複数作れる（name の重複も可）", async () => {
		const userId = await insertUser("many@example.com");

		await db.insert(profiles).values([
			{ userId, name: "Same" },
			{ userId, name: "Same" },
		]);
		const rows = await db
			.select()
			.from(profiles)
			.where(eq(profiles.userId, userId));
		expect(rows).toHaveLength(3);
	});

	it.each([
		["name が空", "empty-name@example.com", { name: "" }],
		["name が 33 文字", "long-name@example.com", { name: "あ".repeat(33) }],
		[
			"bio が 191 文字",
			"long-bio@example.com",
			{ name: "Taro", bio: "あ".repeat(191) },
		],
	])("%s なら入れられない", async (_, email, values) => {
		const userId = await insertUser(email);

		await expect(
			db.insert(profiles).values({ userId, ...values }),
		).rejects.toThrow();
	});

	it("name 32 文字・bio 190 文字なら入れられる", async () => {
		const userId = await insertUser("max@example.com");

		await expect(
			db
				.insert(profiles)
				.values({ userId, name: "あ".repeat(32), bio: "あ".repeat(190) }),
		).resolves.toBeDefined();
	});

	it("name が 1〜32 文字に収まらないアカウントは、デフォルトのプロフィールが作れないので、アカウントもできない", async () => {
		await expect(
			insertUser("too-long@example.com", "あ".repeat(33)),
		).rejects.toThrow();

		const rows = await db
			.select()
			.from(user)
			.where(eq(user.email, "too-long@example.com"));
		expect(rows).toHaveLength(0);
	});
});
