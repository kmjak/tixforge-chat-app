import type {
	CreatedInviteResponse,
	MessageResponse,
	MessagesResponse,
	ProfileResponse,
	WsRoomEvent,
	WsServerEvent,
} from "@chat-app/shared";
import {
	type Account,
	createChannel,
	getLayout,
	login,
	setupServer,
} from "./channel-fixtures";
import { setupTestApp, type TestApp } from "./test-helpers";
import { createWsClients, type WsClient } from "./ws-fixtures";

let t: TestApp;
let url: string;
const clients = createWsClients(() => url);

beforeAll(async () => {
	t = await setupTestApp();
	url = await t.listen();
});

afterAll(async () => {
	await t.close();
});

afterEach(() => {
	clients.closeAll();
});

async function general(account: Account, api: string): Promise<string> {
	const channel = (await getLayout(t, account, api)).channels[0];
	if (!channel) throw new Error("一般が無い");
	return `${api}/channels/${channel.id}/messages`;
}

function send(account: Account, path: string, body: unknown) {
	return t.request("POST", path, { cookie: account.cookie, body: { body } });
}

async function sendOk(account: Account, path: string, body: string) {
	const res = await send(account, path, body);
	expect(res.status).toBe(201);
	return (await res.json()) as MessageResponse;
}

async function list(account: Account, path: string, before?: number) {
	const res = await t.request(
		"GET",
		before === undefined ? path : `${path}?before=${before}`,
		{ cookie: account.cookie },
	);
	expect(res.status).toBe(200);
	return (await res.json()) as MessagesResponse;
}

const isMessage = (id: number) => (event: WsServerEvent) =>
	event.type === "message.created" &&
	(event as WsRoomEvent & { data: MessageResponse }).data.id === id;

/** client だけが受け取る目印を送り、それまでに id のメッセージが届いていないことを確かめる */
async function expectNotReceived(
	client: WsClient,
	marker: { account: Account; path: string },
	id: number,
) {
	const sent = await sendOk(marker.account, marker.path, "marker");
	await client.waitFor(isMessage(sent.id));
	expect(client.events.some(isMessage(id))).toBe(false);
}

/** その人だけがメンバーのサーバーの一般（目印を送る場所） */
async function ownChannel(account: Account) {
	const res = await t.request("POST", "/api/servers", {
		cookie: account.cookie,
		body: { name: "Own", profileId: account.defaultProfileId },
	});
	const server = (await res.json()) as { id: string };
	return { account, path: await general(account, `/api/servers/${server.id}`) };
}

describe("メッセージの送信と配信", () => {
	it("送ったメッセージが、そのチャンネルのメンバーに WebSocket で届く", async () => {
		const { owner, member, stranger, api } = await setupServer(t);
		const path = await general(owner, api);
		const marker = await ownChannel(stranger);
		const memberClient = await clients.connect(member.cookie);
		const strangerClient = await clients.connect(stranger.cookie);

		const sent = await sendOk(owner, path, "  こんにちは  ");

		expect(sent.body).toBe("こんにちは");
		const event = await memberClient.waitFor(isMessage(sent.id));
		expect(event).toEqual({
			type: "message.created",
			room: { type: "channel", id: path.split("/")[5] },
			data: sent,
		});
		await expectNotReceived(strangerClient, marker, sent.id);
	});

	it("送り手はサーバーで選んだプロフィールで表示され、アカウントの id やほかのプロフィールは含まれない", async () => {
		const { owner, member, api } = await setupServer(t);
		const path = await general(owner, api);
		// オーナーにもう 1 つプロフィールを作る（サーバーでは使わない）
		const extra = await t.request("POST", "/api/profiles", {
			cookie: owner.cookie,
			body: { name: "Secret", bio: "" },
		});
		const secret = (await extra.json()) as ProfileResponse;
		const memberClient = await clients.connect(member.cookie);
		const me = (await (
			await t.request("GET", "/api/me", { cookie: owner.cookie })
		).json()) as { id: string };

		const sent = await sendOk(owner, path, "hello");
		const event = await memberClient.waitFor(isMessage(sent.id));
		const page = await list(member, path);

		const expected = {
			id: sent.id,
			kind: "text",
			body: "hello",
			sender: { id: owner.defaultProfileId, name: "Owner" },
			createdAt: expect.any(String),
		};
		expect(sent).toEqual(expected);
		expect(page.messages[0]).toEqual(expected);
		for (const json of [
			JSON.stringify(sent),
			JSON.stringify(event),
			JSON.stringify(page),
		]) {
			expect(json).not.toContain(me.id);
			expect(json).not.toContain(secret.id);
			expect(json).not.toContain("Secret");
		}
	});

	it("空・空白だけ・2001 文字以上のメッセージは送れない", async () => {
		const { owner, api } = await setupServer(t);
		const path = await general(owner, api);
		const before = await list(owner, path);

		for (const body of ["", "   \n ", "あ".repeat(2001), 1, null]) {
			const res = await send(owner, path, body);
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_MESSAGE" });
		}
		expect(await list(owner, path)).toEqual(before);
	});

	it("過去のメッセージを 50 件ずつさかのぼって読める", async () => {
		const { owner, api } = await setupServer(t);
		const path = await general(owner, api);
		for (let i = 1; i <= 120; i++) {
			await sendOk(owner, path, `m${i}`);
		}

		const first = await list(owner, path);
		const second = await list(owner, path, first.messages.at(-1)?.id);
		const third = await list(owner, path, second.messages.at(-1)?.id);

		expect(first.messages.map((m) => m.body)).toEqual(
			Array.from({ length: 50 }, (_, i) => `m${120 - i}`),
		);
		expect(first.hasMore).toBe(true);
		expect(second.messages.map((m) => m.body)).toEqual(
			Array.from({ length: 50 }, (_, i) => `m${70 - i}`),
		);
		expect(second.hasMore).toBe(true);
		// 残り 20 件と、メンバーの参加のメッセージ
		expect(third.messages.map((m) => m.body)).toEqual([
			...Array.from({ length: 20 }, (_, i) => `m${20 - i}`),
			null,
		]);
		expect(third.hasMore).toBe(false);
		for (const before of ["0", "-1", "abc", "1.5", "99999999999999999999"]) {
			const res = await t.request("GET", `${path}?before=${before}`, {
				cookie: owner.cookie,
			});
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "INVALID_CURSOR" });
		}
	});

	it("送り手がプロフィールを変えると、過去のメッセージもそのプロフィールで表示される", async () => {
		const { owner, member, api } = await setupServer(t);
		const path = await general(owner, api);
		const sent = await sendOk(member, path, "before");
		const created = await t.request("POST", "/api/profiles", {
			cookie: member.cookie,
			body: { name: "Renamed", bio: "" },
		});
		const renamed = (await created.json()) as ProfileResponse;

		const changed = await t.request("PATCH", `${api}/members/me`, {
			cookie: member.cookie,
			body: { profileId: renamed.id },
		});
		expect(changed.status).toBe(200);

		const page = await list(owner, path);
		expect(page.messages.find((m) => m.id === sent.id)?.sender).toEqual({
			id: renamed.id,
			name: "Renamed",
		});
	});

	it("サーバーに参加すると、既定のチャンネルに参加のメッセージが入り、WebSocket でも届く", async () => {
		const { owner, api } = await setupServer(t);
		const path = await general(owner, api);
		const guest = await login(t, "Guest");
		const ownerClient = await clients.connect(owner.cookie);
		const invite = (await (
			await t.request("POST", `${api}/invites`, {
				cookie: owner.cookie,
				body: { expiresInHours: null },
			})
		).json()) as CreatedInviteResponse;
		const join = () =>
			t.request("POST", `/api/invites/${invite.token}/join`, {
				cookie: guest.cookie,
				body: { profileId: guest.defaultProfileId },
			});

		expect((await join()).status).toBe(200);

		const [latest] = (await list(owner, path)).messages;
		expect(latest).toEqual({
			id: expect.any(Number),
			kind: "join",
			body: null,
			sender: { id: guest.defaultProfileId, name: "Guest" },
			createdAt: expect.any(String),
		});
		if (!latest) throw new Error("参加のメッセージが無い");
		expect((await ownerClient.waitFor(isMessage(latest.id))).type).toBe(
			"message.created",
		);
		// 既にメンバーなら入らない
		expect((await join()).status).toBe(200);
		expect(
			(await list(owner, path)).messages.filter((m) => m.kind === "join"),
		).toHaveLength(2);
	});
});

describe("メッセージの参加者の確認", () => {
	it("メンバーでない人は、取得・送信できない（別のサーバーのチャンネルを組み合わせた URL も）", async () => {
		const { owner, stranger, api } = await setupServer(t);
		const path = await general(owner, api);
		const other = await setupServer(t);
		const otherPath = await general(other.owner, other.api);
		const mixed = `${api}/channels/${otherPath.split("/")[5]}/messages`;
		await sendOk(owner, path, "secret");

		for (const [who, target] of [
			[stranger, path],
			[owner, mixed],
		] as const) {
			const got = await t.request("GET", target, { cookie: who.cookie });
			const sent = await send(who, target, "x");
			for (const res of [got, sent]) {
				expect(res.status).toBe(404);
				expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
			}
		}
		expect(
			(await list(other.owner, otherPath)).messages.map((m) => m.body),
		).not.toContain("x");
	});

	it("削除したチャンネルでは、取得・送信できない", async () => {
		const { owner, api } = await setupServer(t);
		const channel = await createChannel(t, owner, api, "gone", null);
		const path = `${api}/channels/${channel.id}/messages`;
		await sendOk(owner, path, "before");
		const del = await t.request("DELETE", `${api}/channels/${channel.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);

		const got = await t.request("GET", path, { cookie: owner.cookie });
		const sent = await send(owner, path, "after");
		for (const res of [got, sent]) {
			expect(res.status).toBe(404);
		}
	});
});
