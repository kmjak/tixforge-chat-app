import { WS_CLOSE_SESSION_ENDED, type WsServerEvent } from "@chat-app/shared";
import {
	checkBrowserSession,
	createRealtimeClient,
	type RealtimeStatus,
	realtimeUrl,
	type SocketLike,
} from "./realtime";

/** 偽の WebSocket。server 側の動き（open・message・close）をテストから起こす */
class FakeSocket implements SocketLike {
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onclose: ((event: { code: number }) => void) | null = null;
	closed = false;
	constructor(readonly url: string) {}
	close() {
		this.closed = true;
	}
	serverOpen() {
		this.onopen?.();
	}
	serverSend(data: unknown) {
		this.onmessage?.({ data });
	}
	serverClose(code = 1006) {
		this.onclose?.({ code });
	}
}

/** checkSession の結果を待つ */
const flush = () => new Promise((resolve) => setImmediate(resolve));

function setup(session: boolean | null = true) {
	const sockets: FakeSocket[] = [];
	const timers: { callback: () => void; ms: number; cleared: boolean }[] = [];
	const statuses: RealtimeStatus[] = [];
	const events: WsServerEvent[] = [];
	const onSessionEnded = jest.fn();
	const client = createRealtimeClient({
		url: "ws://server/api/ws",
		onStatus: (status) => statuses.push(status),
		onEvent: (event) => events.push(event),
		onSessionEnded,
		checkSession: async () => session,
		createSocket: (url) => {
			const socket = new FakeSocket(url);
			sockets.push(socket);
			return socket;
		},
		setTimer: (callback, ms) => {
			const timer = { callback, ms, cleared: false };
			timers.push(timer);
			return timer;
		},
		clearTimer: (timer) => {
			(timer as { cleared: boolean }).cleared = true;
		},
	});
	/** 最後に予約した再接続を動かす */
	const fireTimer = () => {
		const timer = timers.at(-1);
		if (!timer || timer.cleared) throw new Error("予約された再接続が無い");
		timer.callback();
	};
	const last = () => {
		const socket = sockets.at(-1);
		if (!socket) throw new Error("接続が無い");
		return socket;
	};
	return {
		client,
		sockets,
		timers,
		statuses,
		events,
		onSessionEnded,
		fireTimer,
		last,
	};
}

describe("realtimeUrl", () => {
	it("http は ws に、https は wss にして /api/ws につなぐ", () => {
		expect(realtimeUrl("http://localhost:3001")).toBe(
			"ws://localhost:3001/api/ws",
		);
		expect(realtimeUrl("https://api.example.com")).toBe(
			"wss://api.example.com/api/ws",
		);
	});
});

describe("createRealtimeClient", () => {
	it("つながるとイベントを受け取り、形の違うものは捨てる", () => {
		const { client, statuses, events, last } = setup();

		client.start();
		last().serverOpen();
		last().serverSend('{"type":"ready"}');
		last().serverSend("not json");

		expect(statuses).toEqual(["connecting", "open"]);
		expect(events).toEqual([{ type: "ready" }]);
	});

	it("切れたら、待ち時間を倍にしながら再接続し、つながったら待ち時間を戻す。再接続した後もイベントを受け取る", async () => {
		const { client, sockets, timers, statuses, events, fireTimer, last } =
			setup();
		client.start();
		last().serverOpen();

		// server の再起動などで切れる → 1 秒後に再接続
		last().serverClose();
		expect(statuses.at(-1)).toBe("reconnecting");
		expect(timers.at(-1)?.ms).toBe(1_000);
		fireTimer();
		expect(sockets).toHaveLength(2);

		// まだ server が戻らず、つながる前に切れる → セッションを確かめてから 2 秒、4 秒…と延ばす
		last().serverClose();
		await flush();
		expect(timers.at(-1)?.ms).toBe(2_000);
		fireTimer();
		last().serverClose();
		await flush();
		expect(timers.at(-1)?.ms).toBe(4_000);
		fireTimer();

		// server が戻る
		last().serverOpen();
		last().serverSend('{"type":"ready"}');
		expect(statuses.at(-1)).toBe("open");
		expect(events).toEqual([{ type: "ready" }]);

		// 次に切れたら、また 1 秒から
		last().serverClose();
		expect(timers.at(-1)?.ms).toBe(1_000);
	});

	it("待ち時間は 30 秒より延ばさない", async () => {
		const { client, timers, fireTimer, last } = setup();
		client.start();
		for (let i = 0; i < 10; i++) {
			last().serverClose();
			await flush();
			fireTimer();
		}
		expect(timers.at(-1)?.ms).toBe(30_000);
	});

	it("セッションが無効（4001）で閉じられたら、再接続せずに知らせる", () => {
		const { client, sockets, timers, statuses, onSessionEnded, last } = setup();
		client.start();
		last().serverOpen();

		last().serverClose(WS_CLOSE_SESSION_ENDED);

		expect(statuses.at(-1)).toBe("ended");
		expect(onSessionEnded).toHaveBeenCalledTimes(1);
		expect(timers).toHaveLength(0);
		expect(sockets).toHaveLength(1);
	});

	it("stop すると接続を閉じ、予約した再接続も取り消す", async () => {
		const { client, sockets, timers, last } = setup();
		client.start();
		last().serverClose();
		await flush();

		client.stop();

		expect(timers.at(-1)?.cleared).toBe(true);
		client.start();
		expect(sockets).toHaveLength(2);
		client.stop();
		expect(sockets[1]?.closed).toBe(true);
		// stop の後に閉じた知らせが来ても、再接続しない
		sockets[1]?.serverClose();
		expect(timers).toHaveLength(1);
	});

	it("つながらずに閉じたとき、セッションが無効なら再接続せずに知らせる", async () => {
		const { client, sockets, timers, statuses, onSessionEnded, last } =
			setup(false);
		client.start();
		last().serverOpen();
		// 接続が切れている間に、別のタブでサインアウトした・期限が切れた
		last().serverClose();
		timers.at(-1)?.callback();
		last().serverClose();
		await flush();

		expect(statuses.at(-1)).toBe("ended");
		expect(onSessionEnded).toHaveBeenCalledTimes(1);
		expect(sockets).toHaveLength(2);
		expect(timers).toHaveLength(1);
	});

	it("つながらずに閉じたとき、セッションが分からない（server に届かない）なら再接続を続ける", async () => {
		const { client, timers, onSessionEnded, last } = setup(null);
		client.start();

		last().serverClose();
		await flush();

		expect(onSessionEnded).not.toHaveBeenCalled();
		expect(timers).toHaveLength(1);
	});
});

describe("checkBrowserSession", () => {
	const respond = (status: number, body: unknown) =>
		jest.fn(async () => new Response(JSON.stringify(body), { status }));

	it("cookie を付けて get-session を呼び、セッションがあれば true、null なら false", async () => {
		const ok = respond(200, { session: {}, user: {} });
		expect(await checkBrowserSession("http://server", ok)).toBe(true);
		expect(ok).toHaveBeenCalledWith("http://server/api/auth/get-session", {
			credentials: "include",
			cache: "no-store",
		});
		expect(await checkBrowserSession("http://server", respond(200, null))).toBe(
			false,
		);
	});

	it("server に届かない・想定外の応答なら null", async () => {
		const failing = jest.fn(async () => {
			throw new TypeError("fetch failed");
		});
		expect(await checkBrowserSession("http://server", failing)).toBeNull();
		expect(
			await checkBrowserSession("http://server", respond(500, {})),
		).toBeNull();
	});
});
