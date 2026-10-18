import type { ProfileService } from "@chat-app/db";
import {
	isValidBio,
	normalizeName,
	type ProfileResponse,
	type ProfilesResponse,
	type ProfileUsagesResponse,
} from "@chat-app/shared";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { ApiError, readJson } from "./errors";

function notFound(): ApiError {
	return new ApiError(404, "NOT_FOUND", "Not Found");
}

function invalidName(): ApiError {
	return new ApiError(400, "INVALID_NAME", "Name must be 1 to 32 characters");
}

function invalidBio(): ApiError {
	return new ApiError(400, "INVALID_BIO", "Bio must be at most 190 characters");
}

/** 本文が JSON のオブジェクトであることを確かめる */
function asObject(body: unknown): Record<string, unknown> {
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new ApiError(400, "BAD_REQUEST", "Request body must be an object");
	}
	return body as Record<string, unknown>;
}

/** name を検査し、前後の空白を除いた値を返す */
function parseName(value: unknown): string {
	const name = typeof value === "string" ? normalizeName(value) : null;
	if (name === null) {
		throw invalidName();
	}
	return name;
}

/** bio を検査し、そのままの値を返す */
function parseBio(value: unknown): string {
	if (typeof value !== "string" || !isValidBio(value)) {
		throw invalidBio();
	}
	return value;
}

/**
 * 自分のプロフィールの API（docs/context/uri.md）。どれも呼び出したアカウントのプロフィールだけを扱い、
 * 他人のもの・存在しないものは 404 にする（存在するかどうかも知らせない）
 */
export function registerProfileRoutes(
	app: Hono<AppEnv>,
	profiles: ProfileService,
): void {
	app.get("/api/profiles", async (c) => {
		const list = await profiles.list(c.get("user").id);
		return c.json<ProfilesResponse>({ profiles: list });
	});

	app.post("/api/profiles", async (c) => {
		const body = asObject(await readJson(c));
		const name = parseName(body.name);
		const bio = body.bio === undefined ? "" : parseBio(body.bio);

		const result = await profiles.create(c.get("user").id, { name, bio });
		if (!result.ok) {
			throw new ApiError(
				409,
				"PROFILE_LIMIT_REACHED",
				"You can have at most 5 profiles",
			);
		}
		return c.json<ProfileResponse>(result.profile, 201);
	});

	app.get("/api/profiles/:profileId", async (c) => {
		const profile = await profiles.get(
			c.get("user").id,
			c.req.param("profileId"),
		);
		if (!profile) {
			throw notFound();
		}
		return c.json<ProfileResponse>(profile);
	});

	app.patch("/api/profiles/:profileId", async (c) => {
		const body = asObject(await readJson(c));
		const name = body.name === undefined ? undefined : parseName(body.name);
		const bio = body.bio === undefined ? undefined : parseBio(body.bio);
		// デフォルトを外すと 0 個になるので、true だけを受け付ける（外すのは別のプロフィールを true にする）
		if (body.isDefault !== undefined && body.isDefault !== true) {
			throw new ApiError(400, "BAD_REQUEST", "isDefault can only be true");
		}

		const userId = c.get("user").id;
		const profileId = c.req.param("profileId");
		let profile = await profiles.update(userId, profileId, { name, bio });
		if (profile && body.isDefault === true) {
			profile = await profiles.setDefault(userId, profileId);
		}
		if (!profile) {
			throw notFound();
		}
		return c.json<ProfileResponse>(profile);
	});

	app.delete("/api/profiles/:profileId", async (c) => {
		const result = await profiles.remove(
			c.get("user").id,
			c.req.param("profileId"),
		);
		if (!result.ok) {
			switch (result.reason) {
				case "not-found":
					throw notFound();
				case "default":
					throw new ApiError(
						409,
						"PROFILE_IS_DEFAULT",
						"The default profile cannot be deleted",
					);
				case "in-use":
					throw new ApiError(
						409,
						"PROFILE_IN_USE",
						"A profile in use cannot be deleted",
					);
			}
		}
		return c.body(null, 204);
	});

	app.get("/api/profiles/:profileId/usages", async (c) => {
		const usages = await profiles.listUsages(
			c.get("user").id,
			c.req.param("profileId"),
		);
		if (!usages) {
			throw notFound();
		}
		return c.json<ProfileUsagesResponse>({
			usages: usages.map(({ type, id, name }) => ({ type, id, name })),
		});
	});
}
