import {
	type ServerResponse,
	WS_CLOSE_SESSION_ENDED,
	type WsRoom,
	type WsServerEvent,
} from "@chat-app/shared";
import type { WSContext } from "hono/ws";
import WebSocket from "ws";
import {
	type Account,
	createChannel,
	getLayout,
	login,
	setupServer,
} from "./channel-fixtures";
import { createRealtimeHub } from "./realtime";
import {
	cookieFrom,
	PASSWORD,
	setupTestApp,
	type TestApp,
	WEB_ORIGIN,
} from "./test-helpers";

let t: TestApp;
let url: string;
let seq = 0;

beforeAll(async () => {
	t = await setupTestApp();
	url = await t.listen();
});

afterAll(async () => {
	await t.close();
});

/** 接続と、届いたイベント・閉じたときのコード */
type Client = {
	ws: WebSocket;
	events: WsServerEvent[];
	/** type のイベントが届くまで待つ */
	waitFor: (type: string) => Promise<WsServerEvent>;
	closed: Promise<number>;
};

const opened: WebSocket[] = [];

afterEach(() => {
	for (const ws of opened.splice(0)) {
		ws.terminate();
	}
});

/** cookie を付けて接続し、ready が届くまで待つ */
async function connect(cookie: string): Promise<Client> {
	const ws = new WebSocket(url, {
		headers: { Cookie: cookie },
		origin: WEB_ORIGIN,
	});
	opened.push(ws);
	const events: WsServerEvent[] = [];
	const waiters: { type: string; resolve: (e: WsServerEvent) => void }[] = [];
	ws.on("message", (data) => {
		const event = JSON.parse(String(data)) as WsServerEvent;
		events.push(event);
		for (const waiter of waiters.filter((w) => w.type === event.type)) {
			waiters.splice(waiters.indexOf(waiter), 1);
			waiter.resolve(event);
		}
	});
	const closed = new Promise<number>((resolve) => {
		ws.on("close", (code) => resolve(code));
	});
	const waitFor = (type: string) =>
		new Promise<WsServerEvent>((resolve) => {
			const found = events.find((e) => e.type === type);
			if (found) {
				resolve(found);
				return;
			}
			waiters.push({ type, resolve });
		});
	await waitFor("ready");
	return { ws, events, waitFor, closed };
}

/** 接続できずに返った HTTP のステータス */
function rejectedStatus(options: {
	cookie?: string;
	origin?: string;
}): Promise<number> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url, {
			headers: options.cookie ? { Cookie: options.cookie } : {},
			origin: options.origin,
		});
		opened.push(ws);
		// 拒否された後に片付けるときのエラーは、確かめる対象ではない
		ws.on("error", () => {});
		ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
		ws.on("open", () => reject(new Error("接続できてしまった")));
	});
}

const channelRoom = (id: string): WsRoom => ({ type: "channel", id });

/** 部屋に test イベントを送る。n で区別する */
function publish(room: WsRoom, n: number) {
	return t.realtime.publish(room, { type: `test-${n}`, room, data: { n } });
}

/** その人だけがメンバーのサーバーを作り、既定のチャンネル（目印を送る部屋）を返す */
async function ownRoom(account: Account): Promise<WsRoom> {
	const res = await t.request("POST", "/api/servers", {
		cookie: account.cookie,
		body: { name: "Own", profileId: account.defaultProfileId },
	});
	const server = (await res.json()) as ServerResponse;
	const layout = await getLayout(t, account, `/api/servers/${server.id}`);
	const general = layout.channels[0];
	if (!general) throw new Error("一般が無い");
	return channelRoom(general.id);
}

/**
 * client に type のイベントが届いていないことを確かめる。client だけが参加者の部屋に目印を送り、
 * 目印が届いた時点で type が届いていなければ、届かなかったとみなす（同じ接続の中では順に届く）
 */
async function expectNotReceived(client: Client, own: WsRoom, type: string) {
	seq += 1;
	await publish(own, 1000 + seq);
	await client.waitFor(`test-${1000 + seq}`);
	expect(client.events.map((e) => e.type)).not.toContain(type);
}

async function generalRoom(account: Account, api: string): Promise<WsRoom> {
	const general = (await getLayout(t, account, api)).channels[0];
	if (!general) throw new Error("一般が無い");
	return channelRoom(general.id);
}

describe("WebSocket の接続", () => {
	it("ログイン済みなら接続でき、ready が届く", async () => {
		const account = await login(t, "Connect");

		const client = await connect(account.cookie);

		expect(client.events).toEqual([{ type: "ready" }]);
	});

	it("未ログイン・違う Origin では接続できない", async () => {
		const account = await login(t, "Rejected");

		expect(await rejectedStatus({ origin: WEB_ORIGIN })).toBe(401);
		expect(
			await rejectedStatus({
				cookie: "better-auth.session_token=x",
				origin: WEB_ORIGIN,
			}),
		).toBe(401);
		expect(
			await rejectedStatus({
				cookie: account.cookie,
				origin: "http://evil.example",
			}),
		).toBe(403);
		expect(await rejectedStatus({ cookie: account.cookie })).toBe(403);
	});
});

describe("部屋への配信", () => {
	it("部屋に送ったイベントが、参加者の接続にだけ届く", async () => {
		const { owner, member, stranger, api } = await setupServer(t);
		const room = await generalRoom(owner, api);
		const strangerRoom = await ownRoom(stranger);
		const ownerA = await connect(owner.cookie);
		const ownerB = await connect(owner.cookie);
		const memberClient = await connect(member.cookie);
		const strangerClient = await connect(stranger.cookie);

		await publish(room, 1);

		const expected = { type: "test-1", room, data: { n: 1 } };
		expect(await ownerA.waitFor("test-1")).toEqual(expected);
		expect(await ownerB.waitFor("test-1")).toEqual(expected);
		expect(await memberClient.waitFor("test-1")).toEqual(expected);
		await expectNotReceived(strangerClient, strangerRoom, "test-1");
	});

	it("接続した後の参加・チャンネルの作成で、その部屋のイベントが届くようになる", async () => {
		const { owner, stranger, api } = await setupServer(t);
		const room = await generalRoom(owner, api);
		const ownerClient = await connect(owner.cookie);
		const strangerClient = await connect(stranger.cookie);

		// 接続したまま、招待で参加する
		const invite = (await (
			await t.request("POST", `${api}/invites`, {
				cookie: owner.cookie,
				body: { expiresInHours: null },
			})
		).json()) as { token: string };
		const joined = await t.request(
			"POST",
			`/api/invites/${invite.token}/join`,
			{
				cookie: stranger.cookie,
				body: { profileId: stranger.defaultProfileId },
			},
		);
		expect(joined.status).toBe(200);
		await publish(room, 2);
		expect((await strangerClient.waitFor("test-2")).type).toBe("test-2");

		// 接続したまま、チャンネルを作る
		const created = await createChannel(t, owner, api, "new", null);
		await publish(channelRoom(created.id), 3);
		expect((await ownerClient.waitFor("test-3")).type).toBe("test-3");
		expect((await strangerClient.waitFor("test-3")).type).toBe("test-3");
	});

	it("参加者でなくなった後は、その部屋のイベントが届かない", async () => {
		const { owner, member, api } = await setupServer(t);
		const general = await generalRoom(owner, api);
		const memberRoom = await ownRoom(member);
		const created = await createChannel(t, owner, api, "gone", null);
		const ownerClient = await connect(owner.cookie);
		const memberClient = await connect(member.cookie);

		// チャンネルを削除した後
		const del = await t.request("DELETE", `${api}/channels/${created.id}`, {
			cookie: owner.cookie,
		});
		expect(del.status).toBe(204);
		await publish(channelRoom(created.id), 4);
		await expectNotReceived(ownerClient, general, "test-4");
		await expectNotReceived(memberClient, memberRoom, "test-4");

		// サーバーを退出した後（退出の API は GT-000010 なので、DB で退出した状態にする）
		await t.db.$client.query(
			`UPDATE server_members SET left_at = now(), profile_id = NULL, left_display_name = 'Member'
			 WHERE server_id = (SELECT server_id FROM channels WHERE id = $1)
			 AND user_id <> (SELECT owner_user_id FROM servers WHERE id = (SELECT server_id FROM channels WHERE id = $1))`,
			[general.id],
		);
		await publish(general, 5);
		expect((await ownerClient.waitFor("test-5")).type).toBe("test-5");
		await expectNotReceived(memberClient, memberRoom, "test-5");
	});
});

describe("セッションと生存確認", () => {
	/** 同じアカウントで 2 つのセッション（2 つの cookie）を作る */
	async function twoSessions() {
		seq += 1;
		const email = `realtime${seq}@example.com`;
		const first = cookieFrom(await t.signUp("Two", email));
		const second = cookieFrom(
			await t.request("POST", "/api/auth/sign-in/email", {
				body: { email, password: PASSWORD },
			}),
		);
		return { first, second };
	}

	it("サインアウトすると、そのセッションの接続が 4001 で切れ、別のセッションの接続は残る", async () => {
		const { first, second } = await twoSessions();
		const a = await connect(first);
		const b = await connect(second);

		const res = await t.request("POST", "/api/auth/sign-out", {
			cookie: first,
		});

		expect(res.status).toBe(200);
		expect(await a.closed).toBe(WS_CLOSE_SESSION_ENDED);
		await t.realtime.checkConnections();
		expect(b.ws.readyState).toBe(WebSocket.OPEN);
	});

	it("セッションが無効になると、生存確認で 4001 で切れる", async () => {
		const { first, second } = await twoSessions();
		const a = await connect(first);
		const b = await connect(second);
		const token = decodeURIComponent(
			first.split("better-auth.session_token=")[1]?.split(".")[0] ?? "",
		);

		// 期限切れ・パスワードの変更などで、セッションの行が無くなった状態にする
		await t.db.$client.query('DELETE FROM "session" WHERE token = $1', [token]);
		await t.realtime.checkConnections();

		expect(await a.closed).toBe(WS_CLOSE_SESSION_ENDED);
		expect(b.ws.readyState).toBe(WebSocket.OPEN);
	});
});

describe("createRealtimeHub の生存確認", () => {
	it("ping に pong が返らない接続は、次の生存確認で切る", async () => {
		const hub = createRealtimeHub({
			listRoomMemberIds: async () => [],
			getSession: async () => ({ sessionId: "s1" }),
		});
		let pong: () => void = () => {};
		const raw = {
			ping: jest.fn(),
			terminate: jest.fn(),
			on: (_event: "pong", listener: () => void) => {
				pong = listener;
			},
		};
		const ws = {
			raw,
			readyState: 1,
			send: jest.fn(),
			close: jest.fn(),
		} as unknown as WSContext;
		hub.connect({ userId: "u1", sessionId: "s1", headers: new Headers(), ws });

		// 1 回目：ping を送る。pong が返れば、2 回目も切らない
		await hub.checkConnections();
		pong();
		await hub.checkConnections();
		expect(raw.ping).toHaveBeenCalledTimes(2);
		expect(raw.terminate).not.toHaveBeenCalled();

		// pong が返らないまま 3 回目
		await hub.checkConnections();
		expect(raw.terminate).toHaveBeenCalledTimes(1);
		expect(raw.ping).toHaveBeenCalledTimes(2);
	});
});
