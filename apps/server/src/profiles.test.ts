import type { ProfileUsageSource } from "@chat-app/db";
import type { ProfileResponse } from "@chat-app/shared";
import { cookieFrom, setupTestApp, type TestApp } from "./test-helpers";

/** 「使用中」のプロフィールの id。割り当ての代わりに、偽の source がサーバー S で使用中と答える */
const inUse = new Set<string>();
const fakeServerSource: ProfileUsageSource = async (_db, profileIds) =>
	profileIds
		.filter((id) => inUse.has(id))
		.map((profileId) => ({
			profileId,
			type: "server",
			id: "server-1",
			name: "S",
		}));

let t: TestApp;
let seq = 0;

beforeAll(async () => {
	t = await setupTestApp({ usageSources: [fakeServerSource] });
});

afterAll(async () => {
	await t.close();
});

/** サインアップしてログインした状態の cookie を返す（デフォルトのプロフィールの name は name） */
async function login(name = "Me") {
	seq += 1;
	const res = await t.signUp(name, `profiles${seq}@example.com`);
	return cookieFrom(res);
}

async function list(cookie: string): Promise<ProfileResponse[]> {
	const res = await t.request("GET", "/api/profiles", { cookie });
	expect(res.status).toBe(200);
	return ((await res.json()) as { profiles: ProfileResponse[] }).profiles;
}

async function create(cookie: string, body: unknown) {
	return t.request("POST", "/api/profiles", { cookie, body });
}

async function createOk(cookie: string, name: string, bio = "") {
	const res = await create(cookie, { name, bio });
	expect(res.status).toBe(201);
	return (await res.json()) as ProfileResponse;
}

async function countDefaults(cookie: string) {
	return (await list(cookie)).filter((p) => p.isDefault).length;
}

describe("一覧", () => {
	it("自分のプロフィールの一覧を取得できる", async () => {
		const me = await login("Main");
		const other = await login("Other");
		await createOk(me, "Game", "ゲーム用");
		await createOk(other, "OtherSub");

		const profiles = await list(me);

		expect(profiles).toEqual([
			{ id: expect.any(String), name: "Main", bio: "", isDefault: true },
			{
				id: expect.any(String),
				name: "Game",
				bio: "ゲーム用",
				isDefault: false,
			},
		]);
	});
});

describe("作成", () => {
	it("name・bio を入力してプロフィールを作れる", async () => {
		const me = await login();

		const res = await create(me, { name: "  Work  ", bio: " 仕事用\n" });

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			id: expect.any(String),
			name: "Work",
			bio: " 仕事用\n",
			isDefault: false,
		});
		// bio は省略できる
		expect(await (await create(me, { name: "NoBio" })).json()).toMatchObject({
			bio: "",
		});
	});

	it("6 個目は作れない", async () => {
		const me = await login();
		for (const name of ["2", "3", "4", "5"]) {
			await createOk(me, name);
		}

		const res = await create(me, { name: "6" });

		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "PROFILE_LIMIT_REACHED" });
		expect(await list(me)).toHaveLength(5);
	});
});

describe("条件を満たさない name・bio では作成・編集できない", () => {
	const invalid: [string, Record<string, unknown>, string][] = [
		["name が空", { name: "" }, "INVALID_NAME"],
		["name が空白だけ", { name: "   " }, "INVALID_NAME"],
		["name が 33 文字", { name: "あ".repeat(33) }, "INVALID_NAME"],
		["name が文字列でない", { name: 1 }, "INVALID_NAME"],
		["bio が 191 文字", { name: "ok", bio: "あ".repeat(191) }, "INVALID_BIO"],
		["bio が文字列でない", { name: "ok", bio: null }, "INVALID_BIO"],
		["name が U+0000 を含む", { name: "a\u0000b" }, "INVALID_NAME"],
		["bio が U+0000 を含む", { name: "ok", bio: "a\u0000b" }, "INVALID_BIO"],
	];

	it.each(invalid)("作成：%s → 400 %s", async (_, body, code) => {
		const me = await login();

		const res = await create(me, body);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code });
		expect(await list(me)).toHaveLength(1);
	});

	it.each(invalid)("編集：%s → 400 %s", async (_, body, code) => {
		const me = await login();
		const profile = await createOk(me, "Before", "before");

		const res = await t.request("PATCH", `/api/profiles/${profile.id}`, {
			cookie: me,
			body,
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code });
		const after = await t.request("GET", `/api/profiles/${profile.id}`, {
			cookie: me,
		});
		expect(await after.json()).toMatchObject({ name: "Before", bio: "before" });
	});

	it("50 文字の name でも、前後の空白を除いて 32 文字なら作れる", async () => {
		const me = await login();

		const res = await create(me, {
			name: ` ${"あ".repeat(32)}${" ".repeat(17)}`,
		});

		expect(res.status).toBe(201);
	});
});

describe("編集", () => {
	it("プロフィールの name・bio を編集できる", async () => {
		const me = await login();
		const profile = await createOk(me, "Before", "before");

		const res = await t.request("PATCH", `/api/profiles/${profile.id}`, {
			cookie: me,
			body: { name: "  After ", bio: "after" },
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			...profile,
			name: "After",
			bio: "after",
		});

		// 片方だけの編集
		const onlyBio = await t.request("PATCH", `/api/profiles/${profile.id}`, {
			cookie: me,
			body: { bio: "" },
		});
		expect(await onlyBio.json()).toMatchObject({ name: "After", bio: "" });
	});

	it("JSON のオブジェクトでない本文は 400 BAD_REQUEST", async () => {
		const me = await login();
		const profile = await createOk(me, "P");

		const res = await t.request("PATCH", `/api/profiles/${profile.id}`, {
			cookie: me,
			body: ["name"],
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("削除", () => {
	it("デフォルトでも使用中でもないプロフィールは削除できる", async () => {
		const me = await login();
		const profile = await createOk(me, "Temp");

		const res = await t.request("DELETE", `/api/profiles/${profile.id}`, {
			cookie: me,
		});

		expect(res.status).toBe(204);
		expect((await list(me)).map((p) => p.id)).not.toContain(profile.id);
		const get = await t.request("GET", `/api/profiles/${profile.id}`, {
			cookie: me,
		});
		expect(get.status).toBe(404);
	});

	it("デフォルトのプロフィールは削除できない", async () => {
		const me = await login();
		const [def] = await list(me);
		if (!def) throw new Error("デフォルトが無い");

		const res = await t.request("DELETE", `/api/profiles/${def.id}`, {
			cookie: me,
		});

		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "PROFILE_IS_DEFAULT" });
		expect(await list(me)).toHaveLength(1);
	});

	it("使用中のプロフィールは削除できない", async () => {
		const me = await login();
		const profile = await createOk(me, "Used");
		inUse.add(profile.id);

		const res = await t.request("DELETE", `/api/profiles/${profile.id}`, {
			cookie: me,
		});

		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "PROFILE_IN_USE" });
		expect((await list(me)).map((p) => p.id)).toContain(profile.id);
	});
});

describe("使用先", () => {
	it("プロフィールの使用先の一覧を取得できる", async () => {
		const me = await login();
		const used = await createOk(me, "Used");
		const free = await createOk(me, "Free");
		inUse.add(used.id);

		const usedRes = await t.request("GET", `/api/profiles/${used.id}/usages`, {
			cookie: me,
		});
		const freeRes = await t.request("GET", `/api/profiles/${free.id}/usages`, {
			cookie: me,
		});

		expect(usedRes.status).toBe(200);
		expect(await usedRes.json()).toEqual({
			usages: [{ type: "server", id: "server-1", name: "S" }],
		});
		expect(await freeRes.json()).toEqual({ usages: [] });
	});
});

describe("デフォルトの切り替え", () => {
	it("デフォルトを別のプロフィールに切り替えられる", async () => {
		const me = await login("First");
		const second = await createOk(me, "Second");

		const res = await t.request("PATCH", `/api/profiles/${second.id}`, {
			cookie: me,
			body: { isDefault: true },
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ name: "Second", isDefault: true });
		expect(await countDefaults(me)).toBe(1);
		expect((await list(me))[0]).toMatchObject({ name: "Second" });
		const meRes = await t.request("GET", "/api/me", { cookie: me });
		expect(await meRes.json()).toMatchObject({
			defaultProfile: { id: second.id, name: "Second" },
		});
	});

	it("isDefault: false は受け付けない（デフォルトが 0 個にならない）", async () => {
		const me = await login();
		const [def] = await list(me);
		if (!def) throw new Error("デフォルトが無い");

		const res = await t.request("PATCH", `/api/profiles/${def.id}`, {
			cookie: me,
			body: { isDefault: false },
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "BAD_REQUEST" });
		expect(await countDefaults(me)).toBe(1);
	});

	it("name・bio とデフォルトへの切り替えを一緒に送ると、両方とも変わる", async () => {
		const me = await login("First");
		const second = await createOk(me, "Second");

		const res = await t.request("PATCH", `/api/profiles/${second.id}`, {
			cookie: me,
			body: { name: "Main", bio: "main", isDefault: true },
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: second.id,
			name: "Main",
			bio: "main",
			isDefault: true,
		});
		expect(await countDefaults(me)).toBe(1);
	});
});

describe("他人のプロフィールを操作する API は 404 を返す", () => {
	it("取得・編集・切り替え・使用先・削除がすべて 404 で、相手のデータは変わらない", async () => {
		const owner = await login("Owner");
		const target = await createOk(owner, "Target", "target");
		const other = await login("Attacker");
		const path = `/api/profiles/${target.id}`;

		const results = await Promise.all([
			t.request("GET", path, { cookie: other }),
			t.request("PATCH", path, { cookie: other, body: { name: "Hacked" } }),
			t.request("PATCH", path, { cookie: other, body: { isDefault: true } }),
			t.request("GET", `${path}/usages`, { cookie: other }),
			t.request("DELETE", path, { cookie: other }),
		]);

		for (const res of results) {
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({
				code: "NOT_FOUND",
				message: "Not Found",
			});
		}
		expect(await list(owner)).toEqual([
			expect.objectContaining({ name: "Owner", isDefault: true }),
			{ ...target },
		]);
		expect(await countDefaults(other)).toBe(1);
	});

	it.each([
		["存在しない id", "00000000-0000-0000-0000-000000000000"],
		["UUID でない id", "abc"],
	])("%s も 404", async (_, id) => {
		const me = await login();

		const res = await t.request("GET", `/api/profiles/${id}`, { cookie: me });

		expect(res.status).toBe(404);
	});
});
