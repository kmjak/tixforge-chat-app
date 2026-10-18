import type {
	ChannelResponse,
	ChannelsResponse,
	CreatedInviteResponse,
	ProfileResponse,
	ServerResponse,
} from "@chat-app/shared";
import { cookieFrom, setupTestApp, type TestApp } from "./test-helpers";

let t: TestApp;
let seq = 0;

beforeAll(async () => {
	t = await setupTestApp();
});

afterAll(async () => {
	await t.close();
});

type Account = { cookie: string; defaultProfileId: string };

async function login(name: string): Promise<Account> {
	seq += 1;
	const res = await t.signUp(name, `channels${seq}@example.com`);
	const cookie = cookieFrom(res);
	const profiles = (await (
		await t.request("GET", "/api/profiles", { cookie })
	).json()) as {
		profiles: ProfileResponse[];
	};
	const def = profiles.profiles[0];
	if (!def) throw new Error("デフォルトのプロフィールが無い");
	return { cookie, defaultProfileId: def.id };
}

/** オーナー・メンバー・メンバーでない人と、サーバーを作る */
async function setup() {
	const owner = await login("Owner");
	const member = await login("Member");
	const stranger = await login("Stranger");
	const created = await t.request("POST", "/api/servers", {
		cookie: owner.cookie,
		body: { name: "S", profileId: owner.defaultProfileId },
	});
	const server = (await created.json()) as ServerResponse;
	const invite = (await (
		await t.request("POST", `/api/servers/${server.id}/invites`, {
			cookie: owner.cookie,
			body: { expiresInHours: null },
		})
	).json()) as CreatedInviteResponse;
	await t.request("POST", `/api/invites/${invite.token}/join`, {
		cookie: member.cookie,
		body: { profileId: member.defaultProfileId },
	});
	return {
		owner,
		member,
		stranger,
		base: `/api/servers/${server.id}/channels`,
	};
}

async function list(a: Account, base: string) {
	const res = await t.request("GET", base, { cookie: a.cookie });
	expect(res.status).toBe(200);
	return ((await res.json()) as ChannelsResponse).channels;
}

function create(a: Account, base: string, name: unknown) {
	return t.request("POST", base, { cookie: a.cookie, body: { name } });
}

async function createOk(a: Account, base: string, name: string) {
	const res = await create(a, base, name);
	expect(res.status).toBe(201);
	return (await res.json()) as ChannelResponse;
}

describe("既定のチャンネル", () => {
	it("サーバーを作ると、一般 のチャンネルがある", async () => {
		const { owner, base } = await setup();

		expect(await list(owner, base)).toEqual([
			{ id: expect.any(String), name: "一般", isDefault: true },
		]);
	});

	it("既定のチャンネルは、名前を変えられるが、削除できない", async () => {
		const { owner, base } = await setup();
		const [general] = await list(owner, base);
		if (!general) throw new Error("一般が無い");

		const renamed = await t.request("PATCH", `${base}/${general.id}`, {
			cookie: owner.cookie,
			body: { name: "lobby" },
		});
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toEqual({
			id: general.id,
			name: "lobby",
			isDefault: true,
		});

		const del = await t.request("DELETE", `${base}/${general.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(409);
		expect(await del.json()).toMatchObject({ code: "CHANNEL_IS_DEFAULT" });
		expect(await list(owner, base)).toHaveLength(1);
	});
});

describe("一覧と権限", () => {
	it("メンバーはチャンネルの一覧を見られ、メンバーでない人は取得できない", async () => {
		const { owner, member, stranger, base } = await setup();
		const random = await createOk(owner, base, "雑談");
		await createOk(owner, base, "games");

		// オーナー以外のメンバーも見られ、作った順に並ぶ
		expect((await list(member, base)).map((ch) => ch.name)).toEqual([
			"一般",
			"雑談",
			"games",
		]);
		const one = await t.request("GET", `${base}/${random.id}`, {
			cookie: member.cookie,
		});
		expect(await one.json()).toEqual(random);

		for (const path of [base, `${base}/${random.id}`]) {
			const res = await t.request("GET", path, { cookie: stranger.cookie });
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({
				code: "NOT_FOUND",
				message: "Not Found",
			});
		}
	});

	it("オーナーはチャンネルを作成・名前の変更・削除でき、オーナー以外はできない", async () => {
		const { owner, member, stranger, base } = await setup();

		const created = await createOk(owner, base, "  new-channel ");
		expect(created).toEqual({
			id: expect.any(String),
			name: "new-channel",
			isDefault: false,
		});
		const renamed = await t.request("PATCH", `${base}/${created.id}`, {
			cookie: owner.cookie,
			body: { name: "renamed_1" },
		});
		expect(await renamed.json()).toMatchObject({ name: "renamed_1" });

		const target = await createOk(owner, base, "target");
		for (const [who, status, code] of [
			[member, 403, "NOT_SERVER_OWNER"],
			[stranger, 404, "NOT_FOUND"],
		] as const) {
			const results = await Promise.all([
				create(who, base, "x"),
				t.request("PATCH", `${base}/${target.id}`, {
					cookie: who.cookie,
					body: { name: "x" },
				}),
				t.request("DELETE", `${base}/${target.id}`, { cookie: who.cookie }),
			]);
			for (const res of results) {
				expect(res.status).toBe(status);
				expect(await res.json()).toMatchObject({ code });
			}
		}
		expect((await list(owner, base)).map((ch) => ch.name)).toEqual([
			"一般",
			"renamed_1",
			"target",
		]);

		const del = await t.request("DELETE", `${base}/${created.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);
		expect((await list(owner, base)).map((ch) => ch.name)).toEqual([
			"一般",
			"target",
		]);
	});
});

describe("名前と上限", () => {
	it.each([
		["空", ""],
		["101 文字", "a".repeat(101)],
		["スペース", "general chat"],
		["絵文字", "chat😀"],
		["記号", "chat!"],
		["文字列でない", 1],
	])(
		"規則に合わない名前では作成・名前の変更ができない（%s）",
		async (_, name) => {
			const { owner, base } = await setup();
			const [general] = await list(owner, base);
			if (!general) throw new Error("一般が無い");

			const created = await create(owner, base, name);
			expect(created.status).toBe(400);
			expect(await created.json()).toMatchObject({
				code: "INVALID_CHANNEL_NAME",
			});
			const renamed = await t.request("PATCH", `${base}/${general.id}`, {
				cookie: owner.cookie,
				body: { name },
			});
			expect(renamed.status).toBe(400);
			expect(await renamed.json()).toMatchObject({
				code: "INVALID_CHANNEL_NAME",
			});
			expect(await list(owner, base)).toEqual([general]);
		},
	);

	it("カテゴリに属さないチャンネルが 10 個あると、11 個目は作れない", async () => {
		const { owner, base } = await setup();
		for (let i = 2; i <= 10; i++) {
			await createOk(owner, base, `c${i}`);
		}

		const res = await create(owner, base, "c11");

		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ code: "CHANNEL_LIMIT_REACHED" });
		expect(await list(owner, base)).toHaveLength(10);
	});

	it("削除したチャンネルは一覧に出ず、上限の数にも含まれない", async () => {
		const { owner, base } = await setup();
		const channels: ChannelResponse[] = [];
		for (let i = 2; i <= 10; i++) {
			channels.push(await createOk(owner, base, `c${i}`));
		}
		const removed = channels[0];
		if (!removed) throw new Error("チャンネルが無い");

		const del = await t.request("DELETE", `${base}/${removed.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);

		expect((await list(owner, base)).map((ch) => ch.id)).not.toContain(
			removed.id,
		);
		for (const res of [
			await t.request("GET", `${base}/${removed.id}`, { cookie: owner.cookie }),
			await t.request("PATCH", `${base}/${removed.id}`, {
				cookie: owner.cookie,
				body: { name: "x" },
			}),
			await t.request("DELETE", `${base}/${removed.id}`, {
				cookie: owner.cookie,
			}),
		]) {
			expect(res.status).toBe(404);
		}
		// 9 個（既定＋8）になったので、もう 1 つ作れる
		expect((await create(owner, base, "after")).status).toBe(201);
		const { rows } = await t.db.$client.query<{ deleted: boolean }>(
			"SELECT deleted_at IS NOT NULL AS deleted FROM channels WHERE id = $1",
			[removed.id],
		);
		expect(rows).toEqual([{ deleted: true }]);
	});
});
