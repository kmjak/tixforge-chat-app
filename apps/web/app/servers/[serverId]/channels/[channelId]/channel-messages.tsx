"use client";

import {
	type MessageResponse,
	type MessagesResponse,
	normalizeMessageBody,
} from "@chat-app/shared";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { callApi } from "../../../../../lib/api";
import { errorMessage } from "../../../../../lib/error-messages";
import { formatMessageTime } from "../../../../../lib/format-time";
import {
	applyLatestPage,
	channelMessageFrom,
	mergeMessages,
	oldestMessageId,
	shouldReplaceWithLatestPage,
} from "../../../../../lib/messages";
import { useRealtimeEvents } from "../../../../components/realtime-provider";
import styles from "./channel-messages.module.css";

/** 一番上（下）から、この距離までを「一番上（下）にいる」とみなす */
const EDGE_PX = 40;

const noSubscribe = () => () => {};

/**
 * ブラウザで描画しているか。サーバー側の描画と hydration の間は false。日時の文字列はブラウザの
 * タイムゾーンで作るので、サーバー側の描画と食い違わないよう、true になってから作る
 */
function useIsClient(): boolean {
	return useSyncExternalStore(
		noSubscribe,
		() => true,
		() => false,
	);
}

/**
 * チャンネルのメッセージ（docs/context/routes/servers-{serverId}-channels-{channelId}.md）。
 * 一番上までスクロールすると古いものを読み込み、WebSocket の message.created で新しいものを足す
 */
export function ChannelMessages({
	serverId,
	channelId,
	initial,
}: {
	serverId: string;
	channelId: string;
	/** サーバー側で読み込んだ最新のページ（新しい順） */
	initial: MessagesResponse;
}) {
	const path = `/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}/messages`;
	const [messages, setMessages] = useState<MessageResponse[]>(() =>
		mergeMessages([], initial.messages),
	);
	const [hasMore, setHasMore] = useState(initial.hasMore);
	const [loadingOlder, setLoadingOlder] = useState(false);
	// 描画し直す前に続けて起きた scroll でも重ねて読み込まないよう、ref でも持つ
	const loadingOlderRef = useRef(false);
	const isClient = useIsClient();
	// catchUp が、読み直しを始めた時点の一番新しい id を見るため
	const messagesRef = useRef(messages);
	messagesRef.current = messages;
	// 画面を置き換えた回数。置き換える前に始めたさかのぼりの応答を捨てるため。ref は最新の回数、
	// state は描画した時点の回数（さかのぼりは、描画した時点の画面と回数を組で使う）
	const generationRef = useRef(0);
	const [generation, setGeneration] = useState(0);
	// 最後に始めた読み直しの番号。先に始めた読み直しの応答が後から届いても反映しないため
	const catchUpSeqRef = useRef(0);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const listRef = useRef<HTMLOListElement>(null);
	/** 次の描画の後に合わせるスクロールの位置（古いものを足した・一番下へ） */
	const pendingScroll = useRef<
		{ type: "bottom" } | { type: "keep"; height: number; top: number } | null
	>({ type: "bottom" });
	const subscribe = useRealtimeEvents();

	/** 新しいメッセージを足す。一番下を見ていたら、足した後も一番下にする */
	const append = useCallback((incoming: MessageResponse[]) => {
		const list = listRef.current;
		const atBottom =
			!list || list.scrollHeight - list.scrollTop - list.clientHeight < EDGE_PX;
		if (atBottom) {
			pendingScroll.current = { type: "bottom" };
		}
		setMessages((current) => mergeMessages(current, incoming));
	}, []);

	useLayoutEffect(() => {
		const list = listRef.current;
		const pending = pendingScroll.current;
		if (!list || !pending) {
			return;
		}
		pendingScroll.current = null;
		list.scrollTop =
			pending.type === "bottom"
				? list.scrollHeight
				: list.scrollHeight - pending.height + pending.top;
	});

	/**
	 * 最新のページを読み直して反映する。画面を開いたとき（読み込んでから購読を始めるまでの分）と、
	 * 再接続したとき（切れていた間の分）に呼ぶ。間に読んでいないものがあれば画面を置き換える
	 */
	const catchUp = useCallback(async () => {
		catchUpSeqRef.current += 1;
		const seq = catchUpSeqRef.current;
		const knownNewestId = messagesRef.current.at(-1)?.id;
		const result = await callApi<MessagesResponse>(path);
		if (seq !== catchUpSeqRef.current) {
			// 後から始めた読み直しがある：そちらの結果を使う
			return;
		}
		if (!result.ok) {
			if (result.code === "NOT_FOUND") {
				// チャンネルが削除された・サーバーを退出していた：読み込み直して 404 の画面にする
				window.location.reload();
			}
			// server に届かないときは、次の再接続で読み直す
			return;
		}
		const list = listRef.current;
		if (
			!list ||
			list.scrollHeight - list.scrollTop - list.clientHeight < EDGE_PX
		) {
			pendingScroll.current = { type: "bottom" };
		}
		const page = result.data;
		const replace = shouldReplaceWithLatestPage(page, knownNewestId);
		if (replace) {
			generationRef.current += 1;
			setGeneration(generationRef.current);
			setHasMore(page.hasMore);
			pendingScroll.current = { type: "bottom" };
		}
		// まだ描画に反映されていない新着・送信の応答を消さないよう、関数で更新する
		setMessages((current) => applyLatestPage(current, page, replace));
	}, [path]);

	useEffect(() => {
		const unsubscribe = subscribe((event) => {
			if (event.type === "ready") {
				void catchUp();
				return;
			}
			const message = channelMessageFrom(event, channelId);
			if (message) {
				append([message]);
			}
		});
		void catchUp();
		return unsubscribe;
	}, [subscribe, channelId, append, catchUp]);

	async function loadOlder() {
		const before = oldestMessageId(messages);
		const list = listRef.current;
		if (loadingOlderRef.current || !hasMore || before === undefined || !list) {
			return;
		}
		loadingOlderRef.current = true;
		setLoadingOlder(true);
		// before（描画した時点の画面）と同じ時点の回数を使う
		const startedGeneration = generation;
		const result = await callApi<MessagesResponse>(`${path}?before=${before}`);
		loadingOlderRef.current = false;
		setLoadingOlder(false);
		if (startedGeneration !== generationRef.current) {
			// 読み込んでいる間に画面を置き換えた：この古いページは、今の画面とつながらない
			return;
		}
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		// 上に足しても、見ていたメッセージの位置がずれないようにする
		pendingScroll.current = {
			type: "keep",
			height: list.scrollHeight,
			top: list.scrollTop,
		};
		setHasMore(result.data.hasMore);
		setMessages((current) => mergeMessages(current, result.data.messages));
	}

	function handleScroll() {
		if ((listRef.current?.scrollTop ?? EDGE_PX) < EDGE_PX) {
			void loadOlder();
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const body = String(new FormData(form).get("body"));
		if (normalizeMessageBody(body) === null) {
			setError(errorMessage("INVALID_MESSAGE"));
			return;
		}
		setSending(true);
		setError(null);
		const result = await callApi<MessageResponse>(path, {
			method: "POST",
			body: { body },
		});
		setSending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		form.reset();
		pendingScroll.current = { type: "bottom" };
		setMessages((current) => mergeMessages(current, [result.data]));
	}

	return (
		<section>
			<h2>メッセージ</h2>
			<ol ref={listRef} className={styles.list} onScroll={handleScroll}>
				<li className={styles.notice}>
					{hasMore
						? loadingOlder
							? "読み込んでいます…"
							: "上へスクロールすると、前のメッセージを読み込みます"
						: "これより前のメッセージはありません"}
				</li>
				{messages.map((message) => (
					<li key={message.id} className={styles.item}>
						<div className={styles.header}>
							<span className={styles.name} title={message.sender.name}>
								{message.sender.name}
							</span>
							{message.kind === "join" && <span>が参加しました</span>}
							<time className={styles.time} dateTime={message.createdAt}>
								{isClient ? formatMessageTime(message.createdAt) : ""}
							</time>
						</div>
						{message.kind === "text" && (
							<p className={styles.body}>{message.body}</p>
						)}
					</li>
				))}
			</ol>
			<form onSubmit={handleSubmit}>
				<label>
					メッセージ（2000 文字まで）{" "}
					<textarea name="body" rows={2} required maxLength={4000} />
				</label>{" "}
				<button type="submit" disabled={sending}>
					送信
				</button>
			</form>
			{error && <p role="alert">{error}</p>}
		</section>
	);
}
