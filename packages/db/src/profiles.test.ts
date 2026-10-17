import { findDefaultProfile } from "./profiles";
import { profiles, user } from "./schema";
import { createTestDb, type TestDb } from "./testing";

let db: TestDb;

beforeAll(async () => {
	db = await createTestDb();
});

afterAll(async () => {
	await db.$client.close();
});

async function insertUser(email: string, name: string): Promise<string> {
	const [row] = await db
		.insert(user)
		.values({ name, email })
		.returning({ id: user.id });
	if (!row) {
		throw new Error("user を作れませんでした");
	}
	return row.id;
}

describe("findDefaultProfile", () => {
	it("そのアカウントのデフォルトのプロフィールを返す（デフォルトでないもの・ほかのアカウントのものは返さない）", async () => {
		const userId = await insertUser("me@example.com", "Me");
		const otherId = await insertUser("other@example.com", "Other");
		await db.insert(profiles).values({ userId, name: "Sub", bio: "sub" });

		const profile = await findDefaultProfile(db, userId);

		expect(profile).toEqual({ id: expect.any(String), name: "Me", bio: "" });
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
