import type { CategoryService } from "@chat-app/db";
import type { CategoryResponse } from "@chat-app/shared";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { readName, readObject, reasonError } from "./channels";
import { ApiError } from "./errors";

/**
 * チャンネルのカテゴリの API（docs/context/uri.md）。一覧はチャンネルの一覧と一緒に返す。
 * メンバーでない・存在しない・削除したカテゴリは 404、メンバーだがオーナーでなければ 403
 */
export function registerCategoryRoutes(
	app: Hono<AppEnv>,
	categories: CategoryService,
): void {
	app.post("/api/servers/:serverId/categories", async (c) => {
		const name = readName(await readObject(c), "INVALID_CATEGORY_NAME");
		const result = await categories.create(
			c.get("user").id,
			c.req.param("serverId"),
			name,
		);
		if (!result.ok) {
			throw result.reason === "limit"
				? new ApiError(
						409,
						"CATEGORY_LIMIT_REACHED",
						"A server can have at most 5 categories",
					)
				: reasonError(result.reason);
		}
		return c.json<CategoryResponse>(result.category, 201);
	});

	app.patch("/api/servers/:serverId/categories/:categoryId", async (c) => {
		const name = readName(await readObject(c), "INVALID_CATEGORY_NAME");
		const result = await categories.rename(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("categoryId"),
			name,
		);
		if (!result.ok) {
			throw reasonError(result.reason);
		}
		return c.json<CategoryResponse>(result.category);
	});

	app.delete("/api/servers/:serverId/categories/:categoryId", async (c) => {
		const result = await categories.remove(
			c.get("user").id,
			c.req.param("serverId"),
			c.req.param("categoryId"),
		);
		if (!result.ok) {
			throw result.reason === "has-default"
				? new ApiError(
						409,
						"CATEGORY_HAS_DEFAULT_CHANNEL",
						"A category with the default channel cannot be deleted",
					)
				: reasonError(result.reason);
		}
		return c.body(null, 204);
	});
}
