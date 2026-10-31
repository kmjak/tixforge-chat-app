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
} from "react";
import { callApi } from "../../../../../lib/api";
import { errorMessage } from "../../../../../lib/error-messages";
import { formatMessageTime } from "../../../../../lib/format-time";
import {
	channelMessageFrom,
	mergeMessages,
	oldestMessageId,
} from "../../../../../lib/messages";
import { useRealtimeEvents } from "../../../../components/realtime-provider";
import styles from "./channel-messages.module.css";

/** 一番上（下）から、この距離までを「一番上（下）にいる」とみなす */
const EDGE_PX = 40;

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

	useEffect(
		() =>
			subscribe((event) => {
				if (event.type === "ready") {
					// 再接続した：切れていた間のメッセージを取りこぼさないよう、最新のページを読み直す
					void callApi<MessagesResponse>(path).then((result) => {
						if (result.ok) {
							append(result.data.messages);
						}
					});
					return;
				}
				const message = channelMessageFrom(event, channelId);
				if (message) {
					append([message]);
				}
			}),
		[subscribe, path, channelId, append],
	);

	async function loadOlder() {
		const before = oldestMessageId(messages);
		const list = listRef.current;
		if (loadingOlder || !hasMore || before === undefined || !list) {
			return;
		}
		setLoadingOlder(true);
		const result = await callApi<MessagesResponse>(`${path}?before=${before}`);
		setLoadingOlder(false);
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
								{formatMessageTime(message.createdAt)}
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
