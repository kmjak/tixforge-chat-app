import { MESSAGE_PAGE_SIZE } from "@chat-app/shared";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { findAliveChannel } from "./channels";
import type { AnyDb } from "./client";
import { findServerMembership } from "./ownership";
import { channels, messages, profiles, serverMembers } from "./schema";
import {
	type MemberProfile,
	type MemberProfileResolver,
	serverProfileResolver,
} from "./servers";

/** 見る人に見せる送り手。退出した人は id が null で、名前に「（退出済み）」を付ける */
export type MessageSender = { id: string | null; name: string };

export type Message = {
	id: number;
	kind: "text" | "join";
	body: string | null;
	sender: MessageSender;
	createdAt: Date;
};

export type MessageService = {
	/**
	 * チャンネルのメッセージを新しい順に MESSAGE_PAGE_SIZE 件。before を付けると、その id より古いもの。
	 * メンバーでない・無い・削除したチャンネルは undefined
	 */
	list: (
		userId: string,
		serverId: string,
		channelId: string,
		before?: number,
	) => Promise<{ messages: Message[]; hasMore: boolean } | undefined>;
	/** 送る。本文は検査済みのもの。メンバーでない・無い・削除したチャンネルは not-found */
	send: (
		userId: string,
		serverId: string,
		channelId: string,
		body: string,
	) => Promise<
		{ ok: true; message: Message } | { ok: false; reason: "not-found" }
	>;
	/**
	 * WebSocket で配るためのメッセージと部屋。送り手は、そのサーバーで選んだプロフィールで表す
	 * （見る人によらない。フレンドが優先になる GT-000015 で、見る人ごとに配り分ける）
	 */
	findForBroadcast: (
		messageId: number,
	) => Promise<{ channelId: string; message: Message } | undefined>;
};

const messageColumns = {
	id: messages.id,
	kind: messages.kind,
	body: messages.body,
	senderUserId: messages.senderUserId,
	createdAt: messages.createdAt,
};

type MessageRow = {
	id: number;
	kind: string;
	body: string | null;
	senderUserId: string;
	createdAt: Date;
};

/** UUID・メンバーの確認の後に、同じサーバーの削除していないチャンネルかを確かめる */
async function canAccess(
	db: AnyDb,
	userId: string,
	serverId: string,
	channelId: string,
): Promise<boolean> {
	return (
		(await findServerMembership(db, userId, serverId)) !== undefined &&
		(await findAliveChannel(db, serverId, channelId)) !== undefined
	);
}

/**
 * メッセージの送り手を、見る人に見せる形にする（docs/context/schema/messages.md「送り手の表示」）。
 * 今のメンバーなら、そのサーバーで選んだプロフィールを resolveMemberProfiles に通したもの。
 * 退出した人なら、退出したときの名前と「（退出済み）」
 */
async function toMessages(
	db: AnyDb,
	resolveMemberProfiles: MemberProfileResolver,
	viewerUserId: string | null,
	serverId: string,
	rows: MessageRow[],
): Promise<Message[]> {
	const senderIds = [...new Set(rows.map((row) => row.senderUserId))];
	const members =
		senderIds.length === 0
			? []
			: await db
					.select({
						userId: serverMembers.userId,
						leftDisplayName: serverMembers.leftDisplayName,
						profileId: profiles.id,
						profileName: profiles.name,
						profileBio: profiles.bio,
					})
					.from(serverMembers)
					.leftJoin(profiles, eq(profiles.id, serverMembers.profileId))
					.where(
						and(
							eq(serverMembers.serverId, serverId),
							inArray(serverMembers.userId, senderIds),
						),
					);
	const current: { userId: string; serverProfile: MemberProfile }[] = [];
	const left = new Map<string, string>();
	for (const member of members) {
		if (member.profileId !== null && member.profileName !== null) {
			current.push({
				userId: member.userId,
				serverProfile: {
					id: member.profileId,
					name: member.profileName,
					bio: member.profileBio ?? "",
				},
			});
		} else {
			left.set(member.userId, member.leftDisplayName ?? "");
		}
	}
	const shown =
		viewerUserId === null
			? await serverProfileResolver(db, "", current)
			: await resolveMemberProfiles(db, viewerUserId, current);
	return rows.map((row) => {
		const profile = shown.get(row.senderUserId);
		const sender: MessageSender = profile
			? { id: profile.id, name: profile.name }
			: { id: null, name: `${left.get(row.senderUserId) ?? ""}（退出済み）` };
		return {
			id: row.id,
			kind: row.kind === "join" ? "join" : "text",
			body: row.body,
			sender,
			createdAt: row.createdAt,
		};
	});
}

/**
 * チャンネルのメッセージ。どの操作も、呼び出した人がそのサーバーの今のメンバーで、チャンネルが
 * 同じサーバーにあり削除されていないことを確かめる（id は連番で推測しやすいため。schema.md「参加者の確認」）
 */
export function createMessageService(
	db: AnyDb,
	{
		resolveMemberProfiles = serverProfileResolver,
	}: { resolveMemberProfiles?: MemberProfileResolver } = {},
): MessageService {
	return {
		list: async (userId, serverId, channelId, before) => {
			if (!(await canAccess(db, userId, serverId, channelId))) {
				return undefined;
			}
			const rows = await db
				.select(messageColumns)
				.from(messages)
				.where(
					and(
						eq(messages.channelId, channelId),
						before === undefined ? undefined : lt(messages.id, before),
					),
				)
				.orderBy(desc(messages.id))
				.limit(MESSAGE_PAGE_SIZE + 1);
			const page = rows.slice(0, MESSAGE_PAGE_SIZE);
			return {
				messages: await toMessages(
					db,
					resolveMemberProfiles,
					userId,
					serverId,
					page,
				),
				hasMore: rows.length > MESSAGE_PAGE_SIZE,
			};
		},

		send: async (userId, serverId, channelId, body) => {
			if (!(await canAccess(db, userId, serverId, channelId))) {
				return { ok: false, reason: "not-found" } as const;
			}
			const [row] = await db
				.insert(messages)
				.values({ channelId, senderUserId: userId, kind: "text", body })
				.returning(messageColumns);
			if (!row) {
				throw new Error("メッセージを保存できませんでした");
			}
			const [message] = await toMessages(
				db,
				resolveMemberProfiles,
				userId,
				serverId,
				[row],
			);
			if (!message) {
				throw new Error("メッセージを表せませんでした");
			}
			return { ok: true, message } as const;
		},

		findForBroadcast: async (messageId) => {
			const [row] = await db
				.select({
					...messageColumns,
					channelId: channels.id,
					serverId: channels.serverId,
				})
				.from(messages)
				.innerJoin(channels, eq(channels.id, messages.channelId))
				.where(eq(messages.id, messageId));
			if (!row) {
				return undefined;
			}
			const [message] = await toMessages(
				db,
				resolveMemberProfiles,
				null,
				row.serverId,
				[row],
			);
			return message ? { channelId: row.channelId, message } : undefined;
		},
	};
}
