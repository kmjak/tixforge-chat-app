import {
	MAX_CHANNELS_PER_CATEGORY,
	MAX_CHANNELS_WITHOUT_CATEGORY,
} from "@chat-app/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "./client";
import { findServerMembership, isUuid, lockServerAsOwner } from "./ownership";
import { channelCategories, channels } from "./schema";

/** 既定のチャンネルの名前。サーバーを作ると、この名前のチャンネルが 1 つできる */
export const DEFAULT_CHANNEL_NAME = "一般";

/** メンバーに見せるチャンネル */
export type Channel = { id: string; name: string; isDefault: boolean };

/** メンバーに見せるカテゴリ */
export type Category = { id: string; name: string };

/** サーバーのチャンネルの並び。channels はカテゴリに属さないチャンネル。どれも並び順のとおり */
export type ChannelLayout = {
	channels: Channel[];
	categories: (Category & { channels: Channel[] })[];
};

/** 並び順の保存で受け取る形。今の削除していないカテゴリ・チャンネルを、すべて 1 回ずつ並べる */
export type ChannelLayoutInput = {
	channels: string[];
	categories: { id: string; channels: string[] }[];
};

type NotFoundOrNotOwner = "not-found" | "not-owner";

export type ChannelService = {
	layout: (
		userId: string,
		serverId: string,
	) => Promise<ChannelLayout | undefined>;
	get: (
		userId: string,
		serverId: string,
		channelId: string,
	) => Promise<Channel | undefined>;
	/** categoryId が null・省略ならカテゴリに属さないチャンネルを作る */
	create: (
		userId: string,
		serverId: string,
		name: string,
		categoryId?: string | null,
	) => Promise<
		| { ok: true; channel: Channel }
		| { ok: false; reason: NotFoundOrNotOwner | "invalid-category" | "limit" }
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
	/**
	 * 並び順を保存する。position を 1 から振り直し、category_id も書き換える（カテゴリに入れる・出す・移す）。
	 * id の集まりが今の削除していないカテゴリ・チャンネルと違えば outdated、同じ id が 2 回ある・
	 * UUID の形でなければ invalid、どれかの並びが上限を超えれば limit
	 */
	saveLayout: (
		userId: string,
		serverId: string,
		input: ChannelLayoutInput,
	) => Promise<
		| { ok: true; layout: ChannelLayout }
		| {
				ok: false;
				reason: NotFoundOrNotOwner | "invalid" | "outdated" | "limit";
		  }
	>;
};

const channelColumns = {
	id: channels.id,
	name: channels.name,
	isDefault: channels.isDefault,
};

/** 削除していないチャンネルの条件 */
const isAlive = isNull(channels.deletedAt);

/** その並び（カテゴリ、または null ならカテゴリに属さないもの）の条件 */
function inGroup(categoryId: string | null) {
	return categoryId === null
		? isNull(channels.categoryId)
		: eq(channels.categoryId, categoryId);
}

/** その並びに入れられるチャンネルの上限 */
function groupLimit(categoryId: string | null): number {
	return categoryId === null
		? MAX_CHANNELS_WITHOUT_CATEGORY
		: MAX_CHANNELS_PER_CATEGORY;
}

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

/** 同じサーバーの、削除していないカテゴリなら true */
export async function isAliveCategory(
	db: AnyDb,
	serverId: string,
	categoryId: string,
): Promise<boolean> {
	if (!isUuid(categoryId)) {
		return false;
	}
	const [row] = await db
		.select({ id: channelCategories.id })
		.from(channelCategories)
		.where(
			and(
				eq(channelCategories.id, categoryId),
				eq(channelCategories.serverId, serverId),
				isNull(channelCategories.deletedAt),
			),
		);
	return row !== undefined;
}

/** サーバーの並びを読む（メンバーかは呼び出し側で確かめる） */
export async function readLayout(
	db: AnyDb,
	serverId: string,
): Promise<ChannelLayout> {
	const categories = await db
		.select({ id: channelCategories.id, name: channelCategories.name })
		.from(channelCategories)
		.where(
			and(
				eq(channelCategories.serverId, serverId),
				isNull(channelCategories.deletedAt),
			),
		)
		.orderBy(
			asc(channelCategories.position),
			asc(channelCategories.createdAt),
			asc(channelCategories.id),
		);
	const rows = await db
		.select({ ...channelColumns, categoryId: channels.categoryId })
		.from(channels)
		.where(and(eq(channels.serverId, serverId), isAlive))
		.orderBy(asc(channels.position), asc(channels.createdAt), asc(channels.id));
	const byCategory = new Map<string | null, Channel[]>();
	for (const { categoryId, ...channel } of rows) {
		const group = byCategory.get(categoryId) ?? [];
		group.push(channel);
		byCategory.set(categoryId, group);
	}
	return {
		channels: byCategory.get(null) ?? [],
		categories: categories.map((category) => ({
			...category,
			channels: byCategory.get(category.id) ?? [],
		})),
	};
}

/**
 * transaction の中で servers の行をロックしてから、オーナーか・チャンネルがあるかを確かめる
 * （確かめた後、書き込むまでの間にオーナーが変わらないように。オーナーを変える処理も
 * servers の行をロックする）
 */
async function lockAndFindChannel(
	tx: AnyDb,
	userId: string,
	serverId: string,
	channelId: string,
): Promise<
	{ ok: true; channel: Channel } | { ok: false; reason: NotFoundOrNotOwner }
> {
	const access = await lockServerAsOwner(tx, userId, serverId);
	// メンバーでなければ、チャンネルがあってもなくても not-found
	if (access === "not-found") {
		return { ok: false, reason: "not-found" };
	}
	const channel = await findAliveChannel(tx, serverId, channelId);
	if (!channel) {
		return { ok: false, reason: "not-found" };
	}
	if (access === "not-owner") {
		return { ok: false, reason: "not-owner" };
	}
	return { ok: true, channel };
}

/** 同じ値が 2 回あれば true */
function hasDuplicates(values: string[]): boolean {
	return new Set(values).size !== values.length;
}

/** 2 つの集まりが同じなら true */
function sameSet(a: string[], b: string[]): boolean {
	const set = new Set(a);
	return set.size === b.length && b.every((value) => set.has(value));
}

/**
 * チャンネルの操作。どれも呼び出した人がサーバーのメンバーのときだけ扱い、メンバーでない・
 * 存在しない・削除したチャンネルは not-found（docs/context/schema.md「参加者の確認」）。
 * 作成・名前の変更・削除・並び順の保存はオーナーだけ（メンバーだがオーナーでなければ not-owner）。
 * オーナーは操作のたびに、servers の行をロックしてから servers.owner_user_id で確かめる
 */
export function createChannelService(db: AnyDb): ChannelService {
	return {
		layout: async (userId, serverId) => {
			if (!(await findServerMembership(db, userId, serverId))) {
				return undefined;
			}
			return readLayout(db, serverId);
		},

		get: async (userId, serverId, channelId) => {
			if (!(await findServerMembership(db, userId, serverId))) {
				return undefined;
			}
			return findAliveChannel(db, serverId, channelId);
		},

		create: (userId, serverId, name, categoryId = null) =>
			db.transaction(async (tx) => {
				// 上限の数を数える前に servers の行をロックする（同時の作成で上限を超えないように）
				const access = await lockServerAsOwner(tx, userId, serverId);
				if (access !== "ok") {
					return { ok: false, reason: access } as const;
				}
				if (
					categoryId !== null &&
					!(await isAliveCategory(tx, serverId, categoryId))
				) {
					return { ok: false, reason: "invalid-category" } as const;
				}
				const [counted] = await tx
					.select({
						alive: sql<number>`count(*) filter (where ${channels.deletedAt} is null)::int`,
						maxPosition: sql<number>`coalesce(max(${channels.position}), 0)::int`,
					})
					.from(channels)
					.where(and(eq(channels.serverId, serverId), inGroup(categoryId)));
				if ((counted?.alive ?? 0) >= groupLimit(categoryId)) {
					return { ok: false, reason: "limit" } as const;
				}
				const [channel] = await tx
					.insert(channels)
					.values({
						serverId,
						categoryId,
						name,
						position: (counted?.maxPosition ?? 0) + 1,
					})
					.returning(channelColumns);
				if (!channel) {
					throw new Error("チャンネルを作れませんでした");
				}
				return { ok: true, channel } as const;
			}),

		rename: (userId, serverId, channelId, name) =>
			db.transaction(async (tx) => {
				const access = await lockAndFindChannel(
					tx,
					userId,
					serverId,
					channelId,
				);
				if (!access.ok) {
					return access;
				}
				const [channel] = await tx
					.update(channels)
					.set({ name, updatedAt: sql`now()` })
					.where(
						and(
							eq(channels.id, channelId),
							eq(channels.serverId, serverId),
							isAlive,
						),
					)
					.returning(channelColumns);
				return channel
					? ({ ok: true, channel } as const)
					: ({ ok: false, reason: "not-found" } as const);
			}),

		remove: (userId, serverId, channelId) =>
			db.transaction(async (tx) => {
				const access = await lockAndFindChannel(
					tx,
					userId,
					serverId,
					channelId,
				);
				if (!access.ok) {
					return access;
				}
				// 既定のチャンネルは削除できない（サーバーに常に 1 つ以上のチャンネルがあるように）
				if (access.channel.isDefault) {
					return { ok: false, reason: "default" } as const;
				}
				await tx
					.update(channels)
					.set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
					.where(
						and(
							eq(channels.id, channelId),
							eq(channels.serverId, serverId),
							isAlive,
						),
					);
				return { ok: true } as const;
			}),

		saveLayout: (userId, serverId, input) =>
			db.transaction(async (tx) => {
				const access = await lockServerAsOwner(tx, userId, serverId);
				if (access !== "ok") {
					return { ok: false, reason: access } as const;
				}
				const groups: { categoryId: string | null; channelIds: string[] }[] = [
					{ categoryId: null, channelIds: input.channels },
					...input.categories.map((category) => ({
						categoryId: category.id,
						channelIds: category.channels,
					})),
				];
				const categoryIds = input.categories.map((category) => category.id);
				const channelIds = groups.flatMap((group) => group.channelIds);
				if (
					![...categoryIds, ...channelIds].every(isUuid) ||
					hasDuplicates(categoryIds) ||
					hasDuplicates(channelIds)
				) {
					return { ok: false, reason: "invalid" } as const;
				}
				const current = await readLayout(tx, serverId);
				const currentChannelIds = [
					...current.channels,
					...current.categories.flatMap((category) => category.channels),
				].map((channel) => channel.id);
				if (
					!sameSet(
						current.categories.map((category) => category.id),
						categoryIds,
					) ||
					!sameSet(currentChannelIds, channelIds)
				) {
					return { ok: false, reason: "outdated" } as const;
				}
				if (
					groups.some(
						(group) => group.channelIds.length > groupLimit(group.categoryId),
					)
				) {
					return { ok: false, reason: "limit" } as const;
				}
				for (const [index, categoryId] of categoryIds.entries()) {
					await tx
						.update(channelCategories)
						.set({ position: index + 1, updatedAt: sql`now()` })
						.where(eq(channelCategories.id, categoryId));
				}
				for (const group of groups) {
					for (const [index, channelId] of group.channelIds.entries()) {
						await tx
							.update(channels)
							.set({
								categoryId: group.categoryId,
								position: index + 1,
								updatedAt: sql`now()`,
							})
							.where(eq(channels.id, channelId));
					}
				}
				return { ok: true, layout: await readLayout(tx, serverId) } as const;
			}),
	};
}

/** カテゴリを削除するときに、中の削除していないチャンネルも一緒に論理削除する */
export async function removeChannelsInCategory(
	tx: AnyDb,
	categoryId: string,
): Promise<void> {
	await tx
		.update(channels)
		.set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(channels.categoryId, categoryId), isAlive));
}

/** カテゴリの中に、既定のチャンネルがあれば true */
export async function categoryHasDefaultChannel(
	db: AnyDb,
	categoryId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: channels.id })
		.from(channels)
		.where(
			and(
				eq(channels.categoryId, categoryId),
				eq(channels.isDefault, true),
				isAlive,
			),
		);
	return row !== undefined;
}
