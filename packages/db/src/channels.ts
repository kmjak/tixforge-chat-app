import { MAX_CHANNELS_WITHOUT_CATEGORY } from "@chat-app/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "./client";
import { findServerMembership, isUuid, lockServer } from "./ownership";
import { channels } from "./schema";

/** 既定のチャンネルの名前。サーバーを作ると、この名前のチャンネルが 1 つできる */
export const DEFAULT_CHANNEL_NAME = "一般";

/** メンバーに見せるチャンネル */
export type Channel = { id: string; name: string; isDefault: boolean };

type NotFoundOrNotOwner = "not-found" | "not-owner";

export type ChannelService = {
	list: (userId: string, serverId: string) => Promise<Channel[] | undefined>;
	get: (
		userId: string,
		serverId: string,
		channelId: string,
	) => Promise<Channel | undefined>;
	create: (
		userId: string,
		serverId: string,
		name: string,
	) => Promise<
		| { ok: true; channel: Channel }
		| { ok: false; reason: NotFoundOrNotOwner | "limit" }
	>;
	rename: (
		userId: string,
		serverId: string,
		channelId: string,
		name: string,
	) => Promise<
		{ ok: true; channel: Channel } | { ok: false; reason: NotFoundOrNotOwner }
	>;
	remove: (
		userId: string,
		serverId: string,
		channelId: string,
	) => Promise<
		{ ok: true } | { ok: false; reason: NotFoundOrNotOwner | "default" }
	>;
};

const channelColumns = {
	id: channels.id,
	name: channels.name,
	isDefault: channels.isDefault,
};

/** 削除していないチャンネルの条件 */
const isAlive = isNull(channels.deletedAt);

async function findAliveChannel(
	db: AnyDb,
	serverId: string,
	channelId: string,
): Promise<Channel | undefined> {
	if (!isUuid(channelId)) {
		return undefined;
	}
	const [row] = await db
		.select(channelColumns)
		.from(channels)
		.where(
			and(eq(channels.id, channelId), eq(channels.serverId, serverId), isAlive),
		);
	return row;
}

/**
 * チャンネルの操作。どれも呼び出した人がサーバーのメンバーのときだけ扱い、メンバーでない・
 * 存在しない・削除したチャンネルは not-found（docs/context/schema.md「参加者の確認」）。
 * 作成・名前の変更・削除はオーナーだけ（メンバーだがオーナーでなければ not-owner）。
 * オーナーは操作のたびに servers.owner_user_id で確かめる
 */
export function createChannelService(db: AnyDb): ChannelService {
	return {
		list: async (userId, serverId) => {
			if (!(await findServerMembership(db, userId, serverId))) {
				return undefined;
			}
			return db
				.select(channelColumns)
				.from(channels)
				.where(and(eq(channels.serverId, serverId), isAlive))
				.orderBy(
					asc(channels.position),
					asc(channels.createdAt),
					asc(channels.id),
				);
		},

		get: async (userId, serverId, channelId) => {
			if (!(await findServerMembership(db, userId, serverId))) {
				return undefined;
			}
			return findAliveChannel(db, serverId, channelId);
		},

		create: (userId, serverId, name) =>
			db.transaction(async (tx) => {
				if (!isUuid(serverId)) {
					return { ok: false, reason: "not-found" } as const;
				}
				// 上限の数を数える前に servers の行をロックする（同時の作成で 10 個を超えないように）
				await lockServer(tx, serverId);
				const membership = await findServerMembership(tx, userId, serverId);
				if (!membership) {
					return { ok: false, reason: "not-found" } as const;
				}
				if (!membership.isOwner) {
					return { ok: false, reason: "not-owner" } as const;
				}
				const [counted] = await tx
					.select({
						alive: sql<number>`count(*) filter (where ${channels.deletedAt} is null)::int`,
						maxPosition: sql<number>`coalesce(max(${channels.position}), 0)::int`,
					})
					.from(channels)
					.where(eq(channels.serverId, serverId));
				if ((counted?.alive ?? 0) >= MAX_CHANNELS_WITHOUT_CATEGORY) {
					return { ok: false, reason: "limit" } as const;
				}
				const [channel] = await tx
					.insert(channels)
					.values({
						serverId,
						name,
						position: (counted?.maxPosition ?? 0) + 1,
					})
					.returning(channelColumns);
				if (!channel) {
					throw new Error("チャンネルを作れませんでした");
				}
				return { ok: true, channel } as const;
			}),

		rename: async (userId, serverId, channelId, name) => {
			const membership = await findServerMembership(db, userId, serverId);
			if (!membership || !(await findAliveChannel(db, serverId, channelId))) {
				return { ok: false, reason: "not-found" } as const;
			}
			if (!membership.isOwner) {
				return { ok: false, reason: "not-owner" } as const;
			}
			const [channel] = await db
				.update(channels)
				.set({ name, updatedAt: sql`now()` })
				.where(and(eq(channels.id, channelId), isAlive))
				.returning(channelColumns);
			return channel
				? ({ ok: true, channel } as const)
				: ({ ok: false, reason: "not-found" } as const);
		},

		remove: async (userId, serverId, channelId) => {
			const membership = await findServerMembership(db, userId, serverId);
			const channel = membership
				? await findAliveChannel(db, serverId, channelId)
				: undefined;
			if (!membership || !channel) {
				return { ok: false, reason: "not-found" } as const;
			}
			if (!membership.isOwner) {
				return { ok: false, reason: "not-owner" } as const;
			}
			// 既定のチャンネルは削除できない（サーバーに常に 1 つ以上のチャンネルがあるように）
			if (channel.isDefault) {
				return { ok: false, reason: "default" } as const;
			}
			await db
				.update(channels)
				.set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
				.where(and(eq(channels.id, channelId), isAlive));
			return { ok: true } as const;
		},
	};
}
