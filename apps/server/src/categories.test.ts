import type { CategoryResponse } from "@chat-app/shared";
import {
	createCategory,
	createChannel,
	getLayout,
	setupServer,
} from "./channel-fixtures";
import { setupTestApp, type TestApp } from "./test-helpers";

let t: TestApp;

beforeAll(async () => {
	t = await setupTestApp();
});

afterAll(async () => {
	await t.close();
});

describe("カテゴリ", () => {
	it("オーナーはカテゴリを作成・名前の変更・削除でき、オーナー以外はできない", async () => {
		const { owner, member, stranger, api } = await setupServer(t);

		const created = await createCategory(t, owner, api, "  雑談 ");
		expect(created).toEqual({ id: expect.any(String), name: "雑談" });
		const renamed = await t.request(
			"PATCH",
			`${api}/categories/${created.id}`,
			{ cookie: owner.cookie, body: { name: "games" } },
		);
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toEqual({ id: created.id, name: "games" });

		const target = await createCategory(t, owner, api, "target");
		for (const [who, status, code] of [
			[member, 403, "NOT_SERVER_OWNER"],
			[stranger, 404, "NOT_FOUND"],
		] as const) {
			const results = await Promise.all([
				t.request("POST", `${api}/categories`, {
					cookie: who.cookie,
					body: { name: "x" },
				}),
				t.request("PATCH", `${api}/categories/${target.id}`, {
					cookie: who.cookie,
					body: { name: "x" },
				}),
				t.request("DELETE", `${api}/categories/${target.id}`, {
					cookie: who.cookie,
				}),
			]);
			for (const res of results) {
				expect(res.status).toBe(status);
				expect(await res.json()).toMatchObject({ code });
			}
		}
		for (const name of ["", "a b", "chat!", "a".repeat(101), 1]) {
			const results = await Promise.all([
				t.request("POST", `${api}/categories`, {
					cookie: owner.cookie,
					body: { name },
				}),
				t.request("PATCH", `${api}/categories/${target.id}`, {
					cookie: owner.cookie,
					body: { name },
				}),
			]);
			for (const res of results) {
				expect(res.status).toBe(400);
				expect(await res.json()).toMatchObject({
					code: "INVALID_CATEGORY_NAME",
				});
			}
		}
		expect((await getLayout(t, member, api)).categories).toEqual([
			{ id: created.id, name: "games", channels: [] },
			{ id: target.id, name: "target", channels: [] },
		]);

		const del = await t.request("DELETE", `${api}/categories/${created.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);
		expect((await getLayout(t, owner, api)).categories).toEqual([
			{ id: target.id, name: "target", channels: [] },
		]);
	});

	it("カテゴリを削除すると、中のチャンネルも一覧から消える", async () => {
		const { owner, member, api } = await setupServer(t);
		const category = await createCategory(t, owner, api, "k");
		const inside = await createChannel(t, owner, api, "inside", category.id);
		const top = await createChannel(t, owner, api, "top", null);

		const del = await t.request("DELETE", `${api}/categories/${category.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);

		const after = await getLayout(t, member, api);
		expect(after.categories).toEqual([]);
		expect(after.channels.map((ch) => ch.name)).toEqual(["一般", "top"]);
		expect(after.channels).toContainEqual(top);
		const get = await t.request("GET", `${api}/channels/${inside.id}`, {
			cookie: owner.cookie,
		});
		expect(get.status).toBe(404);
		const { rows } = await t.db.$client.query<{ deleted: boolean }>(
			"SELECT deleted_at IS NOT NULL AS deleted FROM channels WHERE id = $1",
			[inside.id],
		);
		expect(rows).toEqual([{ deleted: true }]);
	});

	it("既定のチャンネルが入っているカテゴリは、削除できない", async () => {
		const { owner, api } = await setupServer(t);
		const category = await createCategory(t, owner, api, "k");
		const other = await createChannel(t, owner, api, "other", category.id);
		const [general] = (await getLayout(t, owner, api)).channels;
		if (!general) throw new Error("一般が無い");
		const moved = await t.request("PUT", `${api}/channel-layout`, {
			cookie: owner.cookie,
			body: {
				channels: [],
				categories: [{ id: category.id, channels: [general.id, other.id] }],
			},
		});
		expect(moved.status).toBe(200);

		const del = await t.request("DELETE", `${api}/categories/${category.id}`, {
			cookie: owner.cookie,
		});

		expect(del.status).toBe(409);
		expect(await del.json()).toMatchObject({
			code: "CATEGORY_HAS_DEFAULT_CHANNEL",
		});
		expect((await getLayout(t, owner, api)).categories).toEqual([
			{ id: category.id, name: "k", channels: [general, other] },
		]);
	});

	it("カテゴリが 5 個あると、6 個目は作れない", async () => {
		const { owner, api } = await setupServer(t);
		const created: CategoryResponse[] = [];
		for (let i = 1; i <= 5; i++) {
			created.push(await createCategory(t, owner, api, `k${i}`));
		}

		const res = await t.request("POST", `${api}/categories`, {
			cookie: owner.cookie,
			body: { name: "k6" },
		});

		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "CATEGORY_LIMIT_REACHED" });
		expect((await getLayout(t, owner, api)).categories).toHaveLength(5);
		// 削除したものは数えない
		const first = created[0];
		if (!first) throw new Error("カテゴリが無い");
		await t.request("DELETE", `${api}/categories/${first.id}`, {
			cookie: owner.cookie,
		});
		await createCategory(t, owner, api, "k6");
	});
});
