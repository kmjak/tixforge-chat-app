import { MAX_CATEGORIES } from "@chat-app/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
	type Category,
	categoryHasDefaultChannel,
	isAliveCategory,
	removeChannelsInCategory,
} from "./channels";
import type { AnyDb } from "./client";
import { lockServerAsOwner } from "./ownership";
import { channelCategories } from "./schema";

type NotFoundOrNotOwner = "not-found" | "not-owner";

export type CategoryService = {
	create: (
		userId: string,
		serverId: string,
		name: string,
	) => Promise<
		| { ok: true; category: Category }
		| { ok: false; reason: NotFoundOrNotOwner | "limit" }
	>;
	rename: (
		userId: string,
		serverId: string,
		categoryId: string,
		name: string,
	) => Promise<
		{ ok: true; category: Category } | { ok: false; reason: NotFoundOrNotOwner }
	>;
	/** 中の削除していないチャンネルも一緒に論理削除する。中に既定のチャンネルがあれば has-default */
	remove: (
		userId: string,
		serverId: string,
		categoryId: string,
	) => Promise<
		{ ok: true } | { ok: false; reason: NotFoundOrNotOwner | "has-default" }
	>;
};

const categoryColumns = {
	id: channelCategories.id,
	name: channelCategories.name,
};

/** 削除していないカテゴリの条件 */
const isAlive = isNull(channelCategories.deletedAt);

/**
 * カテゴリを、servers の行をロックしてから、オーナーか・同じサーバーの削除していないカテゴリかを
 * 確かめる。メンバーでなければ、カテゴリがあっても not-found
 */
async function lockAndFindCategory(
	tx: AnyDb,
	userId: string,
	serverId: string,
	categoryId: string,
): Promise<{ ok: true } | { ok: false; reason: NotFoundOrNotOwner }> {
	const access = await lockServerAsOwner(tx, userId, serverId);
	if (
		access === "not-found" ||
		!(await isAliveCategory(tx, serverId, categoryId))
	) {
		return { ok: false, reason: "not-found" };
	}
	if (access === "not-owner") {
		return { ok: false, reason: "not-owner" };
	}
	return { ok: true };
}

/**
 * チャンネルのカテゴリの操作。どれもオーナーだけ（docs/context/schema/channel_categories.md）。
 * メンバーでない・存在しない・削除したカテゴリは not-found、メンバーだがオーナーでなければ not-owner。
 * 一覧はチャンネルの一覧（ChannelService.layout）と一緒に返す
 */
export function createCategoryService(db: AnyDb): CategoryService {
	return {
		create: (userId, serverId, name) =>
			db.transaction(async (tx) => {
				// 上限の数を数える前に servers の行をロックする（同時の作成で 5 個を超えないように）
				const access = await lockServerAsOwner(tx, userId, serverId);
				if (access !== "ok") {
					return { ok: false, reason: access } as const;
				}
				const [counted] = await tx
					.select({
						alive: sql<number>`count(*) filter (where ${channelCategories.deletedAt} is null)::int`,
						maxPosition: sql<number>`coalesce(max(${channelCategories.position}), 0)::int`,
					})
					.from(channelCategories)
					.where(eq(channelCategories.serverId, serverId));
				if ((counted?.alive ?? 0) >= MAX_CATEGORIES) {
					return { ok: false, reason: "limit" } as const;
				}
				const [category] = await tx
					.insert(channelCategories)
					.values({
						serverId,
						name,
						position: (counted?.maxPosition ?? 0) + 1,
					})
					.returning(categoryColumns);
				if (!category) {
					throw new Error("カテゴリを作れませんでした");
				}
				return { ok: true, category } as const;
			}),

		rename: (userId, serverId, categoryId, name) =>
			db.transaction(async (tx) => {
				const access = await lockAndFindCategory(
					tx,
					userId,
					serverId,
					categoryId,
				);
				if (!access.ok) {
					return access;
				}
				const [category] = await tx
					.update(channelCategories)
					.set({ name, updatedAt: sql`now()` })
					.where(
						and(
							eq(channelCategories.id, categoryId),
							eq(channelCategories.serverId, serverId),
							isAlive,
						),
					)
					.returning(categoryColumns);
				return category
					? ({ ok: true, category } as const)
					: ({ ok: false, reason: "not-found" } as const);
			}),

		remove: (userId, serverId, categoryId) =>
			db.transaction(async (tx) => {
				const access = await lockAndFindCategory(
					tx,
					userId,
					serverId,
					categoryId,
				);
				if (!access.ok) {
					return access;
				}
				// 既定のチャンネルは削除できないので、それが入っているカテゴリも削除できない
				if (await categoryHasDefaultChannel(tx, categoryId)) {
					return { ok: false, reason: "has-default" } as const;
				}
				await removeChannelsInCategory(tx, categoryId);
				await tx
					.update(channelCategories)
					.set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
					.where(
						and(
							eq(channelCategories.id, categoryId),
							eq(channelCategories.serverId, serverId),
							isAlive,
						),
					);
				return { ok: true } as const;
			}),
	};
}
