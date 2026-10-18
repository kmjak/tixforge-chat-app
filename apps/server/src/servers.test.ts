import type {
	CreatedInviteResponse,
	InviteResponse,
	ProfileResponse,
	ServerMembersResponse,
	ServerResponse,
	ServersResponse,
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

type Account = {
	cookie: string;
	userId: string;
	email: string;
	defaultProfileId: string;
};

/** サインアップしてログインした状態のアカウント（デフォルトのプロフィールの name は name） */
async function login(name: string): Promise<Account> {
	seq += 1;
	const email = `servers${seq}@example.com`;
	const res = await t.signUp(name, email);
	const body = (await res.json()) as { user: { id: string } };
	const cookie = cookieFrom(res);
	const profiles = (await (
		await t.request("GET", "/api/profiles", { cookie })
	).json()) as {
		profiles: ProfileResponse[];
	};
	const def = profiles.profiles[0];
	if (!def) throw new Error("デフォルトのプロフィールが無い");
	return { cookie, userId: body.user.id, email, defaultProfileId: def.id };
}

async function createProfile(
	a: Account,
	name: string,
): Promise<ProfileResponse> {
	const res = await t.request("POST", "/api/profiles", {
		cookie: a.cookie,
		body: { name },
	});
	return (await res.json()) as ProfileResponse;
}

async function createServer(
	a: Account,
	profileId = a.defaultProfileId,
	name = "S",
) {
	const res = await t.request("POST", "/api/servers", {
		cookie: a.cookie,
		body: { name, profileId },
	});
	expect(res.status).toBe(201);
	return (await res.json()) as ServerResponse;
}

async function createInvite(
	a: Account,
	serverId: string,
	expiresInHours: number | null = 24,
) {
	const res = await t.request("POST", `/api/servers/${serverId}/invites`, {
		cookie: a.cookie,
		body: { expiresInHours },
	});
	expect(res.status).toBe(201);
	return (await res.json()) as CreatedInviteResponse;
}

function join(a: Account, token: string, profileId = a.defaultProfileId) {
	return t.request("POST", `/api/invites/${token}/join`, {
		cookie: a.cookie,
		body: { profileId },
	});
}

async function members(a: Account, serverId: string) {
	const res = await t.request("GET", `/api/servers/${serverId}/members`, {
		cookie: a.cookie,
	});
	expect(res.status).toBe(200);
	return ((await res.json()) as ServerMembersResponse).members;
}

async function myServers(a: Account) {
	const res = await t.request("GET", "/api/servers", { cookie: a.cookie });
	return ((await res.json()) as ServersResponse).servers;
}

describe("作成", () => {
	it("サーバーを作ると、作った人がオーナーとして参加し、選んだプロフィールで表示される", async () => {
		const owner = await login("Owner");
		const work = await createProfile(owner, "Work");

		const server = await createServer(owner, work.id, "  My Server ");

		expect(server).toEqual({
			id: expect.any(String),
			name: "My Server",
			isOwner: true,
			myProfile: { id: work.id, name: "Work" },
		});
		expect(await myServers(owner)).toEqual([server]);
		expect(await members(owner, server.id)).toEqual([
			{
				profile: { id: work.id, name: "Work", bio: "" },
				isOwner: true,
				isMe: true,
			},
		]);
	});

	it.each([
		["空", ""],
		["空白だけ", "   "],
		["101 文字", "あ".repeat(101)],
		["文字列でない", 1],
	])(
		"名前が空または 101 文字以上のサーバーは作れない（%s）",
		async (_, name) => {
			const owner = await login("Owner");

			const res = await t.request("POST", "/api/servers", {
				cookie: owner.cookie,
				body: { name, profileId: owner.defaultProfileId },
			});

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_SERVER_NAME" });
			expect(await myServers(owner)).toEqual([]);
		},
	);

	it("100 文字の名前なら作れ、他人のプロフィールでは作れない", async () => {
		const owner = await login("Owner");
		const other = await login("Other");

		await createServer(owner, owner.defaultProfileId, "あ".repeat(100));
		const res = await t.request("POST", "/api/servers", {
			cookie: owner.cookie,
			body: { name: "S", profileId: other.defaultProfileId },
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "INVALID_PROFILE" });
	});
});

describe("招待リンク", () => {
	it("メンバーが、有効期限を選んで招待リンクを作れる", async () => {
		const owner = await login("Owner");
		const server = await createServer(owner);

		for (const hours of [1, 6, 12, 24, 48]) {
			const before = Date.now();
			const invite = await createInvite(owner, server.id, hours);
			expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
			const expiresAt = Date.parse(invite.expiresAt ?? "");
			// DB の時刻で計算するので、数秒の幅を持たせる
			expect(Math.abs(expiresAt - (before + hours * 3_600_000))).toBeLessThan(
				10_000,
			);
		}
		expect((await createInvite(owner, server.id, null)).expiresAt).toBeNull();

		for (const expiresInHours of [0, 2, "24", undefined]) {
			const res = await t.request("POST", `/api/servers/${server.id}/invites`, {
				cookie: owner.cookie,
				body: { expiresInHours },
			});
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_EXPIRY" });
		}
	});

	it("招待リンクを開き、プロフィールを選んで参加できる", async () => {
		const owner = await login("Owner");
		const guest = await login("Guest");
		const game = await createProfile(guest, "Game");
		const server = await createServer(owner);
		const { token } = await createInvite(owner, server.id);

		const info = await t.request("GET", `/api/invites/${token}`, {
			cookie: guest.cookie,
		});
		expect(info.status).toBe(200);
		expect((await info.json()) as InviteResponse).toMatchObject({
			server: { id: server.id, name: "S" },
			isMember: false,
		});

		// 他人のプロフィールでは参加できない
		const wrong = await join(guest, token, owner.defaultProfileId);
		expect(wrong.status).toBe(400);
		expect(await wrong.json()).toMatchObject({ code: "INVALID_PROFILE" });

		const res = await join(guest, token, game.id);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			serverId: server.id,
			alreadyMember: false,
		});
		expect(await myServers(guest)).toEqual([
			{
				id: server.id,
				name: "S",
				isOwner: false,
				myProfile: { id: game.id, name: "Game" },
			},
		]);
		expect(
			(await members(owner, server.id)).map((m) => m.profile.name),
		).toEqual(["Owner", "Game"]);
	});

	it("期限が切れた招待リンク・存在しない招待リンクでは参加できない", async () => {
		const owner = await login("Owner");
		const guest = await login("Guest");
		const server = await createServer(owner);
		const expired = await createInvite(owner, server.id, 1);
		await t.db.$client.query(
			"UPDATE server_invites SET expires_at = now() - interval '1 second' WHERE token = $1",
			[expired.token],
		);

		for (const [token, status, code] of [
			[expired.token, 410, "INVITE_EXPIRED"],
			["no-such-token", 404, "INVITE_NOT_FOUND"],
		] as const) {
			const info = await t.request("GET", `/api/invites/${token}`, {
				cookie: guest.cookie,
			});
			expect(info.status).toBe(status);
			expect(await info.json()).toMatchObject({ code });
			const res = await join(guest, token);
			expect(res.status).toBe(status);
			expect(await res.json()).toMatchObject({ code });
		}
		expect(await members(owner, server.id)).toHaveLength(1);

		// 無制限のリンクは参加できる
		const unlimited = await createInvite(owner, server.id, null);
		expect((await join(guest, unlimited.token)).status).toBe(200);
	});

	it("既に参加しているサーバーの招待リンクでは二重に参加しない", async () => {
		const owner = await login("Owner");
		const guest = await login("Guest");
		const other = await createProfile(guest, "Other");
		const server = await createServer(owner);
		const { token } = await createInvite(owner, server.id);
		await join(guest, token);

		const info = await t.request("GET", `/api/invites/${token}`, {
			cookie: guest.cookie,
		});
		expect(await info.json()).toMatchObject({ isMember: true });
		const again = await join(guest, token, other.id);

		expect(again.status).toBe(200);
		expect(await again.json()).toEqual({
			serverId: server.id,
			alreadyMember: true,
		});
		expect(await members(owner, server.id)).toHaveLength(2);
		// 使うプロフィールも変わらない
		expect((await myServers(guest))[0]?.myProfile.id).toBe(
			guest.defaultProfileId,
		);
	});
});

describe("メンバー", () => {
	it("メンバーの一覧では、各メンバーがサーバーで選んだプロフィールだけが出る", async () => {
		const owner = await login("Owner");
		const guest = await login("GuestDefault");
		const secret = await createProfile(guest, "Secret");
		const shown = await createProfile(guest, "Shown");
		const server = await createServer(owner);
		const { token } = await createInvite(owner, server.id);
		await join(guest, token, shown.id);

		const res = await t.request("GET", `/api/servers/${server.id}/members`, {
			cookie: owner.cookie,
		});
		const text = await res.text();

		expect(JSON.parse(text)).toEqual({
			members: [
				{
					profile: { id: owner.defaultProfileId, name: "Owner", bio: "" },
					isOwner: true,
					isMe: true,
				},
				{
					profile: { id: shown.id, name: "Shown", bio: "" },
					isOwner: false,
					isMe: false,
				},
			],
		});
		for (const hidden of [
			guest.userId,
			guest.email,
			guest.defaultProfileId,
			"GuestDefault",
			secret.id,
			"Secret",
			owner.userId,
		]) {
			expect(text).not.toContain(hidden);
		}
	});

	it("参加した後で、使うプロフィールを変えられる", async () => {
		const owner = await login("Owner");
		const guest = await login("Guest");
		const next = await createProfile(guest, "Next");
		const server = await createServer(owner);
		const { token } = await createInvite(owner, server.id);
		await join(guest, token);

		const res = await t.request(
			"PATCH",
			`/api/servers/${server.id}/members/me`,
			{
				cookie: guest.cookie,
				body: { profileId: next.id },
			},
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			myProfile: { id: next.id, name: "Next" },
		});
		expect((await members(owner, server.id))[1]?.profile.name).toBe("Next");

		const wrong = await t.request(
			"PATCH",
			`/api/servers/${server.id}/members/me`,
			{
				cookie: guest.cookie,
				body: { profileId: owner.defaultProfileId },
			},
		);
		expect(wrong.status).toBe(400);
		expect(await wrong.json()).toMatchObject({ code: "INVALID_PROFILE" });
	});

	it("参加していないサーバーの情報・メンバーは取得できない", async () => {
		const owner = await login("Owner");
		const stranger = await login("Stranger");
		const server = await createServer(owner);
		const path = `/api/servers/${server.id}`;

		const results = await Promise.all([
			t.request("GET", path, { cookie: stranger.cookie }),
			t.request("GET", `${path}/members`, { cookie: stranger.cookie }),
			t.request("PATCH", `${path}/members/me`, {
				cookie: stranger.cookie,
				body: { profileId: stranger.defaultProfileId },
			}),
			t.request("POST", `${path}/invites`, {
				cookie: stranger.cookie,
				body: { expiresInHours: null },
			}),
			t.request("GET", "/api/servers/not-a-uuid", { cookie: stranger.cookie }),
		]);

		for (const res of results) {
			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({
				code: "NOT_FOUND",
				message: "Not Found",
			});
		}
		expect(await myServers(stranger)).toEqual([]);
	});
});

describe("プロフィールの使用先", () => {
	it("サーバーで使用中のプロフィールは、使用先の一覧に出て、削除できない", async () => {
		const owner = await login("Owner");
		const used = await createProfile(owner, "Used");
		const server = await createServer(owner, used.id);

		const usages = await t.request("GET", `/api/profiles/${used.id}/usages`, {
			cookie: owner.cookie,
		});
		expect(await usages.json()).toEqual({
			usages: [{ type: "server", id: server.id, name: "S" }],
		});
		const del = await t.request("DELETE", `/api/profiles/${used.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(409);
		expect(await del.json()).toMatchObject({ code: "PROFILE_IN_USE" });

		// 使うプロフィールを変えると、前のものは使用先から外れて削除できる
		await t.request("PATCH", `/api/servers/${server.id}/members/me`, {
			cookie: owner.cookie,
			body: { profileId: owner.defaultProfileId },
		});
		const after = await t.request("GET", `/api/profiles/${used.id}/usages`, {
			cookie: owner.cookie,
		});
		expect(await after.json()).toEqual({ usages: [] });
		const delAfter = await t.request("DELETE", `/api/profiles/${used.id}`, {
			cookie: owner.cookie,
		});
		expect(delAfter.status).toBe(204);
	});
});
