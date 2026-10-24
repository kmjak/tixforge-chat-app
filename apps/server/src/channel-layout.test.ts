import type { ChannelLayoutRequest, ChannelResponse } from "@chat-app/shared";
import {
	type Account,
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

function save(a: Account, api: string, body: unknown) {
	return t.request("PUT", `${api}/channel-layout`, { cookie: a.cookie, body });
}

describe("並び順", () => {
	it("チャンネルをカテゴリに入れる・出す・移すことができる", async () => {
		const { owner, api } = await setupServer(t);
		const a = await createCategory(t, owner, api, "a");
		const b = await createCategory(t, owner, api, "b");
		const [general] = (await getLayout(t, owner, api)).channels;
		if (!general) throw new Error("一般が無い");
		const top = await createChannel(t, owner, api, "top", null);
		// カテゴリを選んで作れる
		const inA = await createChannel(t, owner, api, "in-a", a.id);
		const inB = await createChannel(t, owner, api, "in-b", b.id);
		expect(await getLayout(t, owner, api)).toEqual({
			channels: [general, top],
			categories: [
				{ ...a, channels: [inA] },
				{ ...b, channels: [inB] },
			],
		});

		// top を a に入れ、in-a を出し、in-b を a に移す
		const res = await save(owner, api, {
			channels: [general.id, inA.id],
			categories: [
				{ id: a.id, channels: [top.id, inB.id] },
				{ id: b.id, channels: [] },
			],
		} satisfies ChannelLayoutRequest);

		const expected = {
			channels: [general, inA],
			categories: [
				{ ...a, channels: [top, inB] },
				{ ...b, channels: [] },
			],
		};
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(expected);
		expect(await getLayout(t, owner, api)).toEqual(expected);

		// 読み込んだ後にチャンネルが増えていたら、古い並びでは保存できない
		await createChannel(t, owner, api, "new", null);
		const outdated = await save(owner, api, {
			channels: [general.id, inA.id],
			categories: [
				{ id: a.id, channels: [top.id, inB.id] },
				{ id: b.id, channels: [] },
			],
		});
		expect(outdated.status).toBe(409);
		expect(await outdated.json()).toMatchObject({ code: "LAYOUT_OUTDATED" });
	});

	it("別のサーバーのカテゴリには作れず、形が違う並びは保存できない", async () => {
		const { owner, api } = await setupServer(t);
		const other = await setupServer(t);
		const othersCategory = await createCategory(
			t,
			other.owner,
			other.api,
			"other",
		);
		const before = await getLayout(t, owner, api);

		for (const categoryId of [othersCategory.id, "not-a-uuid", 1]) {
			const res = await t.request("POST", `${api}/channels`, {
				cookie: owner.cookie,
				body: { name: "x", categoryId },
			});
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_CATEGORY" });
		}
		for (const body of [
			{},
			{ channels: "x", categories: [] },
			{ channels: [], categories: [{ id: 1, channels: [] }] },
			{ channels: [1], categories: [] },
		]) {
			const res = await save(owner, api, body);
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_LAYOUT" });
		}
		expect(await getLayout(t, owner, api)).toEqual(before);
	});

	it("10 個のチャンネルがあるカテゴリには、それ以上入れられない", async () => {
		const { owner, api } = await setupServer(t);
		const full = await createCategory(t, owner, api, "full");
		const inFull: ChannelResponse[] = [];
		for (let i = 1; i <= 10; i++) {
			inFull.push(await createChannel(t, owner, api, `f${i}`, full.id));
		}
		const [general] = (await getLayout(t, owner, api)).channels;
		if (!general) throw new Error("一般が無い");
		const top = await createChannel(t, owner, api, "top", null);
		const before = await getLayout(t, owner, api);

		// 作成
		const created = await t.request("POST", `${api}/channels`, {
			cookie: owner.cookie,
			body: { name: "f11", categoryId: full.id },
		});
		expect(created.status).toBe(409);
		expect(await created.json()).toMatchObject({
			code: "CHANNEL_LIMIT_REACHED",
		});
		// 移動
		const moved = await save(owner, api, {
			channels: [general.id],
			categories: [
				{ id: full.id, channels: [...inFull.map((ch) => ch.id), top.id] },
			],
		});
		expect(moved.status).toBe(409);
		expect(await moved.json()).toMatchObject({ code: "CHANNEL_LIMIT_REACHED" });

		expect(await getLayout(t, owner, api)).toEqual(before);
	});

	it("保存した順が、メンバー全員のチャンネルの一覧に反映される", async () => {
		const { owner, member, stranger, api } = await setupServer(t);
		const a = await createCategory(t, owner, api, "a");
		const b = await createCategory(t, owner, api, "b");
		const [general] = (await getLayout(t, owner, api)).channels;
		if (!general) throw new Error("一般が無い");
		const x = await createChannel(t, owner, api, "x", null);
		const y = await createChannel(t, owner, api, "y", a.id);
		const z = await createChannel(t, owner, api, "z", a.id);
		const body = {
			channels: [x.id, general.id],
			categories: [
				{ id: b.id, channels: [] },
				{ id: a.id, channels: [z.id, y.id] },
			],
		};

		for (const [who, status] of [
			[member, 403],
			[stranger, 404],
		] as const) {
			expect((await save(who, api, body)).status).toBe(status);
		}
		expect((await save(owner, api, body)).status).toBe(200);

		expect(await getLayout(t, member, api)).toEqual({
			channels: [x, general],
			categories: [
				{ ...b, channels: [] },
				{ ...a, channels: [z, y] },
			],
		});
	});
});
