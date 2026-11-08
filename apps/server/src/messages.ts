import type { Message, MessageService } from "@chat-app/db";
import {
	type MessageResponse,
	type MessagesResponse,
	normalizeMessageBody,
} from "@chat-app/shared";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { notFound, readObject } from "./channels";
import { ApiError } from "./errors";
import type { RealtimeHub } from "./realtime";

/** 応答・イベントの形にする（日時は ISO 8601 の文字列） */
function toResponse(message: Message): MessageResponse {
	return { ...message, createdAt: message.createdAt.toISOString() };
}

/** before（これより古いものを取る）を読む。正の整数でなければ 400 */
function parseBefore(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const before = /^[1-9][0-9]{0,15}$/.test(value) ? Number(value) : Number.NaN;
	if (!Number.isSafeInteger(before)) {
		throw new ApiError(
			400,
			"INVALID_CURSOR",
			"before must be a positive integer message id",
		);
	}
	return before;
}

/**
 * メッセージを WebSocket で、そのチャンネルの部屋に message.created として配る関数を作る
 * （docs/context/ws.md）。送信の API と、招待での参加（参加のメッセージ）から呼ぶ。失敗しても例外にしない
 */
export function createMessageBroadcaster(
	messages: MessageService,
	realtime: RealtimeHub,
): (messageId: number) => Promise<void> {
	return async (messageId) => {
		// メッセージは保存済みなので、配るのに失敗しても API は成功として返す
		// （受け取れなかった人は、開き直したとき・再接続したときに一覧で読む）
		try {
			const found = await messages.findForBroadcast(messageId);
			if (!found) {
				return;
			}
			const room = { type: "channel", id: found.channelId } as const;
			await realtime.publish(room, {
				type: "message.created",
				room,
				data: toResponse(found.message),
			});
		} catch (error) {
			console.error("メッセージを WebSocket で配れませんでした", error);
		}
	};
}

/**
 * チャンネルのメッセージの API（docs/context/uri.md）。メンバーでない・存在しない・削除した
 * チャンネルは 404（schema.md「参加者の確認」）
 */
export function registerMessageRoutes(
	app: Hono<AppEnv>,
	{
		messages,
		broadcast,
	}: {
		messages: MessageService;
		broadcast: (messageId: number) => Promise<void>;
	},
): void {
	const path = "/api/servers/:serverId/channels/:channelId/messages";

	app.get(path, async (c) => {
		const before = parseBefore(c.req.query("before"));
		const page = await messages.list(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("channelId"),
			before,
		);
		if (!page) {
			throw notFound();
		}
		return c.json<MessagesResponse>({
			messages: page.messages.map(toResponse),
			hasMore: page.hasMore,
		});
	});

	app.post(path, async (c) => {
		const { body } = await readObject(c);
		const normalized =
			typeof body === "string" ? normalizeMessageBody(body) : null;
		if (normalized === null) {
			throw new ApiError(
				400,
				"INVALID_MESSAGE",
				"Message must be 1 to 2000 characters",
			);
		}
		const result = await messages.send(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("channelId"),
			normalized,
		);
		if (!result.ok) {
			throw notFound();
		}
		await broadcast(result.message.id);
		return c.json<MessageResponse>(toResponse(result.message), 201);
	});
}
