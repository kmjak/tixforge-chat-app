import type { ServerService } from "@chat-app/db";
import {
	type CreatedInviteResponse,
	type InviteResponse,
	isInviteExpiryHours,
	type JoinServerResponse,
	normalizeServerName,
	type ServerMembersResponse,
	type ServerResponse,
	type ServersResponse,
} from "@chat-app/shared";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { ApiError, readJson } from "./errors";

function notFound(): ApiError {
	return new ApiError(404, "NOT_FOUND", "Not Found");
}

function invalidProfile(): ApiError {
	return new ApiError(400, "INVALID_PROFILE", "The profile is not yours");
}

function inviteError(reason: "not-found" | "expired"): ApiError {
	return reason === "expired"
		? new ApiError(410, "INVITE_EXPIRED", "The invite has expired")
		: new ApiError(404, "INVITE_NOT_FOUND", "The invite was not found");
}

/** 本文が JSON のオブジェクトであることを確かめる */
async function readObject(
	c: Parameters<typeof readJson>[0],
): Promise<Record<string, unknown>> {
	const body = await readJson(c);
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new ApiError(400, "BAD_REQUEST", "Request body must be an object");
	}
	return body as Record<string, unknown>;
}

/** 選んだプロフィールの id。文字列でなければ、自分のプロフィールでないのと同じ扱い */
function parseProfileId(value: unknown): string {
	if (typeof value !== "string") {
		throw invalidProfile();
	}
	return value;
}

/**
 * サーバーと招待リンクの API（docs/context/uri.md）。サーバーの情報はメンバーにだけ返し、
 * メンバーでない・存在しないものは 404 にする（存在するかどうかも知らせない）
 */
export function registerServerRoutes(
	app: Hono<AppEnv>,
	servers: ServerService,
): void {
	app.post("/api/servers", async (c) => {
		const body = await readObject(c);
		const name =
			typeof body.name === "string" ? normalizeServerName(body.name) : null;
		if (name === null) {
			throw new ApiError(
				400,
				"INVALID_SERVER_NAME",
				"Server name must be 1 to 100 characters",
			);
		}
		const profileId = parseProfileId(body.profileId);

		const result = await servers.create(c.get("user").id, { name, profileId });
		if (!result.ok) {
			throw invalidProfile();
		}
		return c.json<ServerResponse>(result.server, 201);
	});

	app.get("/api/servers", async (c) => {
		const list = await servers.list(c.get("user").id);
		return c.json<ServersResponse>({ servers: list });
	});

	app.get("/api/servers/:serverId", async (c) => {
		const server = await servers.get(c.get("user").id, c.req.param("serverId"));
		if (!server) {
			throw notFound();
		}
		return c.json<ServerResponse>(server);
	});

	app.get("/api/servers/:serverId/members", async (c) => {
		const members = await servers.listMembers(
			c.get("user").id,
			c.req.param("serverId"),
		);
		if (!members) {
			throw notFound();
		}
		return c.json<ServerMembersResponse>({ members });
	});

	app.patch("/api/servers/:serverId/members/me", async (c) => {
		const body = await readObject(c);
		const profileId = parseProfileId(body.profileId);

		const result = await servers.changeMyProfile(
			c.get("user").id,
			c.req.param("serverId"),
			profileId,
		);
		if (!result.ok) {
			throw result.reason === "not-found" ? notFound() : invalidProfile();
		}
		return c.json<ServerResponse>(result.server);
	});

	app.post("/api/servers/:serverId/invites", async (c) => {
		const body = await readObject(c);
		if (!isInviteExpiryHours(body.expiresInHours)) {
			throw new ApiError(
				400,
				"INVALID_EXPIRY",
				"expiresInHours must be 1, 6, 12, 24, 48 or null",
			);
		}

		const invite = await servers.createInvite(
			c.get("user").id,
			c.req.param("serverId"),
			body.expiresInHours,
		);
		if (!invite) {
			throw notFound();
		}
		return c.json<CreatedInviteResponse>(
			{
				token: invite.token,
				expiresAt: invite.expiresAt?.toISOString() ?? null,
			},
			201,
		);
	});

	app.get("/api/invites/:token", async (c) => {
		const result = await servers.findInvite(
			c.get("user").id,
			c.req.param("token"),
		);
		if (!result.ok) {
			throw inviteError(result.reason);
		}
		const { invite } = result;
		return c.json<InviteResponse>({
			server: invite.server,
			isMember: invite.isMember,
			expiresAt: invite.expiresAt?.toISOString() ?? null,
		});
	});

	app.post("/api/invites/:token/join", async (c) => {
		const body = await readObject(c);
		const profileId = parseProfileId(body.profileId);

		const result = await servers.join(
			c.get("user").id,
			c.req.param("token"),
			profileId,
		);
		if (!result.ok) {
			throw result.reason === "invalid-profile"
				? invalidProfile()
				: inviteError(result.reason);
		}
		return c.json<JoinServerResponse>({
			serverId: result.serverId,
			alreadyMember: result.alreadyMember,
		});
	});
}
