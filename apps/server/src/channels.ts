import type { ChannelService } from "@chat-app/db";
import {
	type ChannelResponse,
	type ChannelsResponse,
	normalizeChannelName,
} from "@chat-app/shared";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { ApiError, readJson } from "./errors";

function notFound(): ApiError {
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

function reasonError(reason: "not-found" | "not-owner"): ApiError {
	return reason === "not-owner" ? notOwner() : notFound();
}

/** 本文からチャンネル名を取り出し、規則に合わなければ 400 にする */
async function readChannelName(
	c: Parameters<typeof readJson>[0],
): Promise<string> {
	const body = await readJson(c);
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new ApiError(400, "BAD_REQUEST", "Request body must be an object");
	}
	const { name } = body as Record<string, unknown>;
	const normalized =
		typeof name === "string" ? normalizeChannelName(name) : null;
	if (normalized === null) {
		throw new ApiError(
			400,
			"INVALID_CHANNEL_NAME",
			"Channel name must be 1 to 100 letters, digits, hyphens or underscores",
		);
	}
	return normalized;
}

/**
 * チャンネルの API（docs/context/uri.md）。メンバーでない・存在しない・削除したチャンネルは 404、
 * メンバーだがオーナーでない人の作成・名前の変更・削除は 403
 */
export function registerChannelRoutes(
	app: Hono<AppEnv>,
	channels: ChannelService,
): void {
	app.get("/api/servers/:serverId/channels", async (c) => {
		const list = await channels.list(c.get("user").id, c.req.param("serverId"));
		if (!list) {
			throw notFound();
		}
		return c.json<ChannelsResponse>({ channels: list });
	});

	app.post("/api/servers/:serverId/channels", async (c) => {
		const name = await readChannelName(c);
		const result = await channels.create(
			c.get("user").id,
			c.req.param("serverId"),
			name,
		);
		if (!result.ok) {
			throw result.reason === "limit"
				? new ApiError(
						409,
						"CHANNEL_LIMIT_REACHED",
						"A server can have at most 10 channels without a category",
					)
				: reasonError(result.reason);
		}
		return c.json<ChannelResponse>(result.channel, 201);
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
		const name = await readChannelName(c);
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
