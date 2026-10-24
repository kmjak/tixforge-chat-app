// テストだけで使う補助関数。サーバー・カテゴリ・チャンネルを API から作る
import type {
	CategoryResponse,
	ChannelLayoutResponse,
	ChannelResponse,
	CreatedInviteResponse,
	ProfileResponse,
	ServerResponse,
} from "@chat-app/shared";
import { cookieFrom, type TestApp } from "./test-helpers";

let seq = 0;

export type Account = { cookie: string; defaultProfileId: string };

export async function login(t: TestApp, name: string): Promise<Account> {
	seq += 1;
	const res = await t.signUp(name, `fixture${seq}@example.com`);
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

/** オーナー・メンバー・メンバーでない人と、サーバーを作る。api はそのサーバーの API のパス */
export async function setupServer(t: TestApp) {
	const owner = await login(t, "Owner");
	const member = await login(t, "Member");
	const stranger = await login(t, "Stranger");
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
	const api = `/api/servers/${server.id}`;
	return { owner, member, stranger, api };
}

export async function getLayout(t: TestApp, a: Account, api: string) {
	const res = await t.request("GET", `${api}/channels`, { cookie: a.cookie });
	expect(res.status).toBe(200);
	return (await res.json()) as ChannelLayoutResponse;
}

export async function createCategory(
	t: TestApp,
	a: Account,
	api: string,
	name: string,
) {
	const res = await t.request("POST", `${api}/categories`, {
		cookie: a.cookie,
		body: { name },
	});
	expect(res.status).toBe(201);
	return (await res.json()) as CategoryResponse;
}

export async function createChannel(
	t: TestApp,
	a: Account,
	api: string,
	name: string,
	categoryId: string | null,
) {
	const res = await t.request("POST", `${api}/channels`, {
		cookie: a.cookie,
		body: { name, categoryId },
	});
	expect(res.status).toBe(201);
	return (await res.json()) as ChannelResponse;
}
