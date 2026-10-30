import type { ChannelLayoutInput, ChannelService } from "@chat-app/db";
import {
	type ChannelLayoutResponse,
	type ChannelResponse,
	normalizeChannelName,
} from "@chat-app/shared";
import type { Context, Hono } from "hono";
import type { AppEnv } from "./app";
import { ApiError, readJson } from "./errors";

export function notFound(): ApiError {
	return new ApiError(404, "NOT_FOUND", "Not Found");
}

/** メンバーにはサーバーとチャンネルが見えているので、存在を隠さずに理由を返す */
function notOwner(): ApiError {
	return new ApiError(
		403,
		"NOT_SERVER_OWNER",
		"Only the server owner can manage channels",
	);
}

export function reasonError(reason: "not-found" | "not-owner"): ApiError {
	return reason === "not-owner" ? notOwner() : notFound();
}

/** 本文を JSON のオブジェクトとして読む。オブジェクトでなければ 400 */
export async function readObject(c: Context): Promise<Record<string, unknown>> {
	const body = await readJson(c);
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new ApiError(400, "BAD_REQUEST", "Request body must be an object");
	}
	return body as Record<string, unknown>;
}

/**
 * 本文の name を、チャンネル名の規則（カテゴリ名も同じ）で確かめて返す。合わなければ 400 の code にする
 */
export function readName(body: Record<string, unknown>, code: string): string {
	const { name } = body;
	const normalized =
		typeof name === "string" ? normalizeChannelName(name) : null;
	if (normalized === null) {
		throw new ApiError(
			400,
			code,
			"Name must be 1 to 100 letters, digits, hyphens or underscores",
		);
	}
	return normalized;
}

function channelLimitReached(): ApiError {
	return new ApiError(
		409,
		"CHANNEL_LIMIT_REACHED",
		"A category or the channels without a category can have at most 10 channels",
	);
}

function invalidLayout(): ApiError {
	return new ApiError(
		400,
		"INVALID_LAYOUT",
		"Layout must be { channels: string[], categories: { id: string, channels: string[] }[] }",
	);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

/** 並び順の保存の本文を読む。形が違えば 400 INVALID_LAYOUT */
function readLayout(body: Record<string, unknown>): ChannelLayoutInput {
	const { channels, categories } = body;
	if (!isStringArray(channels) || !Array.isArray(categories)) {
		throw invalidLayout();
	}
	return {
		channels,
		categories: categories.map((category: unknown) => {
			if (typeof category !== "object" || category === null) {
				throw invalidLayout();
			}
			const { id, channels: ids } = category as Record<string, unknown>;
			if (typeof id !== "string" || !isStringArray(ids)) {
				throw invalidLayout();
			}
			return { id, channels: ids };
		}),
	};
}

/**
 * チャンネルと並び順の API（docs/context/uri.md）。メンバーでない・存在しない・削除したチャンネルは 404、
 * メンバーだがオーナーでない人の作成・名前の変更・削除・並び順の保存は 403
 */
export function registerChannelRoutes(
	app: Hono<AppEnv>,
	channels: ChannelService,
): void {
	app.get("/api/servers/:serverId/channels", async (c) => {
		const layout = await channels.layout(
			c.get("user").id,
			c.req.param("serverId"),
		);
		if (!layout) {
			throw notFound();
		}
		return c.json<ChannelLayoutResponse>(layout);
	});

	app.post("/api/servers/:serverId/channels", async (c) => {
		const body = await readObject(c);
		const name = readName(body, "INVALID_CHANNEL_NAME");
		const { categoryId = null } = body;
		if (categoryId !== null && typeof categoryId !== "string") {
			throw new ApiError(
				400,
				"INVALID_CATEGORY",
				"categoryId must be a string or null",
			);
		}
		const result = await channels.create(
			c.get("user").id,
			c.req.param("serverId"),
			name,
			categoryId,
		);
		if (!result.ok) {
			throw result.reason === "limit"
				? channelLimitReached()
				: result.reason === "invalid-category"
					? new ApiError(400, "INVALID_CATEGORY", "Category not found")
					: reasonError(result.reason);
		}
		return c.json<ChannelResponse>(result.channel, 201);
	});

	app.put("/api/servers/:serverId/channel-layout", async (c) => {
		const layout = readLayout(await readObject(c));
		const result = await channels.saveLayout(
			c.get("user").id,
			c.req.param("serverId"),
			layout,
		);
		if (!result.ok) {
			switch (result.reason) {
				case "invalid":
					throw invalidLayout();
				case "outdated":
					throw new ApiError(
						409,
						"LAYOUT_OUTDATED",
						"Channels or categories have changed since the layout was loaded",
					);
				case "limit":
					throw channelLimitReached();
				default:
					throw reasonError(result.reason);
			}
		}
		return c.json<ChannelLayoutResponse>(result.layout);
	});

	app.get("/api/servers/:serverId/channels/:channelId", async (c) => {
		const channel = await channels.get(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("channelId"),
		);
		if (!channel) {
			throw notFound();
		}
		return c.json<ChannelResponse>(channel);
	});

	app.patch("/api/servers/:serverId/channels/:channelId", async (c) => {
		const name = readName(await readObject(c), "INVALID_CHANNEL_NAME");
		const result = await channels.rename(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("channelId"),
			name,
		);
		if (!result.ok) {
			throw reasonError(result.reason);
		}
		return c.json<ChannelResponse>(result.channel);
	});

	app.delete("/api/servers/:serverId/channels/:channelId", async (c) => {
		const result = await channels.remove(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("channelId"),
		);
		if (!result.ok) {
			throw result.reason === "default"
				? new ApiError(
						409,
						"CHANNEL_IS_DEFAULT",
						"The default channel cannot be deleted",
					)
				: reasonError(result.reason);
		}
		return c.body(null, 204);
	});
}
