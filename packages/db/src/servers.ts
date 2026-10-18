import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "./client";
import { findOwnProfile, isUuid, lockUser } from "./ownership";
import type { ProfileUsage, ProfileUsageSource } from "./profiles";
import { profiles, serverInvites, serverMembers, servers } from "./schema";

/** 自分が参加しているサーバー */
export type ServerSummary = {
	id: string;
	name: string;
	isOwner: boolean;
	/** そのサーバーで自分が使うプロフィール */
	myProfile: { id: string; name: string };
};

/** ほかのメンバーに見せるプロフィール */
export type MemberProfile = { id: string; name: string; bio: string };

/** メンバーの一覧の 1 行。アカウントの id は含めない */
export type ServerMember = {
	profile: MemberProfile;
	isOwner: boolean;
	isMe: boolean;
};

/**
 * 見る人ごとに、メンバーに見せるプロフィールを決める。今は「そのサーバーで選んだプロフィール」を返す。
 * GT-000015 で、見る人がフレンドならフレンドに割り当てたプロフィールにする（schema.md「フレンドが優先」）
 */
export type MemberProfileResolver = (
	db: AnyDb,
	viewerUserId: string,
	members: { userId: string; serverProfile: MemberProfile }[],
) => Promise<Map<string, MemberProfile>>;

export const serverProfileResolver: MemberProfileResolver = async (
	_db,
	_viewerUserId,
	members,
) => new Map(members.map((m) => [m.userId, m.serverProfile]));

export type InviteInfo = {
	server: { id: string; name: string };
	isMember: boolean;
	expiresAt: Date | null;
};

export type ServerService = {
	create: (
		userId: string,
		input: { name: string; profileId: string },
	) => Promise<
		| { ok: true; server: ServerSummary }
		| { ok: false; reason: "invalid-profile" }
	>;
	list: (userId: string) => Promise<ServerSummary[]>;
	get: (userId: string, serverId: string) => Promise<ServerSummary | undefined>;
	listMembers: (
		userId: string,
		serverId: string,
	) => Promise<ServerMember[] | undefined>;
	changeMyProfile: (
		userId: string,
		serverId: string,
		profileId: string,
	) => Promise<
		| { ok: true; server: ServerSummary }
		| { ok: false; reason: "not-found" | "invalid-profile" }
	>;
	createInvite: (
		userId: string,
		serverId: string,
		expiresInHours: number | null,
	) => Promise<{ token: string; expiresAt: Date | null } | undefined>;
	findInvite: (
		userId: string,
		token: string,
	) => Promise<
		| { ok: true; invite: InviteInfo }
		| { ok: false; reason: "not-found" | "expired" }
	>;
	join: (
		userId: string,
		token: string,
		profileId: string,
	) => Promise<
		| { ok: true; serverId: string; alreadyMember: boolean }
		| { ok: false; reason: "not-found" | "expired" | "invalid-profile" }
	>;
};

/** 招待リンクのトークン。暗号論的な乱数 32 バイトの base64url（docs/context/schema.md「id の規則」） */
export function generateInviteToken(): string {
	return randomBytes(32).toString("base64url");
}

/** 「メンバー」の条件。退出（GT-000010）した行は含めない */
const isCurrentMember = isNull(serverMembers.leftAt);

/**
 * サーバーで使用中のプロフィールの使用先（docs/context/schema.md「プロフィールの割り当て」）。
 * 退出した行の profile_id は「直前のプロフィール」で、使用中ではない
 */
export const serverProfileUsageSource: ProfileUsageSource = async (
	db,
	profileIds,
) => {
	if (profileIds.length === 0) {
		return [];
	}
	const rows = await db
		.select({
			profileId: serverMembers.profileId,
			id: servers.id,
			name: servers.name,
		})
		.from(serverMembers)
		.innerJoin(servers, eq(servers.id, serverMembers.serverId))
		.where(and(inArray(serverMembers.profileId, profileIds), isCurrentMember));
	return rows.flatMap((row): ProfileUsage[] =>
		row.profileId
			? [
					{
						profileId: row.profileId,
						type: "server",
						id: row.id,
						name: row.name,
					},
				]
			: [],
	);
};

/** userId がメンバーのサーバーを、自分のプロフィールと一緒に取る（serverId を渡せば 1 つだけ） */
async function selectMyServers(
	db: AnyDb,
	userId: string,
	serverId?: string,
): Promise<ServerSummary[]> {
	const rows = await db
		.select({
			id: servers.id,
			name: servers.name,
			ownerUserId: servers.ownerUserId,
			profileId: profiles.id,
			profileName: profiles.name,
		})
		.from(serverMembers)
		.innerJoin(servers, eq(servers.id, serverMembers.serverId))
		.innerJoin(profiles, eq(profiles.id, serverMembers.profileId))
		.where(
			and(
				eq(serverMembers.userId, userId),
				isCurrentMember,
				serverId === undefined ? undefined : eq(servers.id, serverId),
			),
		)
		.orderBy(asc(serverMembers.joinedAt), asc(servers.id));
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		isOwner: row.ownerUserId === userId,
		myProfile: { id: row.profileId, name: row.profileName },
	}));
}

async function getMyServer(
	db: AnyDb,
	userId: string,
	serverId: string,
): Promise<ServerSummary | undefined> {
	if (!isUuid(serverId)) {
		return undefined;
	}
	const [server] = await selectMyServers(db, userId, serverId);
	return server;
}

type InviteRow = {
	serverId: string;
	serverName: string;
	expiresAt: Date | null;
	expired: boolean;
};

/** 招待リンクのトークンの形（generateInviteToken が作る 32 バイトの base64url = 43 文字） */
const INVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

async function selectInvite(
	db: AnyDb,
	token: string,
): Promise<InviteRow | undefined> {
	// 形の違うトークン（U+0000 を含むものなど）は、DB に渡さずに「存在しない」とする
	if (!INVITE_TOKEN.test(token)) {
		return undefined;
	}
	const [row] = await db
		.select({
			serverId: servers.id,
			serverName: servers.name,
			expiresAt: serverInvites.expiresAt,
			// 期限は DB の時刻で比べる（server と DB の時計のずれの影響を受けないように）
			expired: sql<boolean>`${serverInvites.expiresAt} is not null and ${serverInvites.expiresAt} <= now()`,
		})
		.from(serverInvites)
		.innerJoin(servers, eq(servers.id, serverInvites.serverId))
		.where(eq(serverInvites.token, token));
	return row;
}

async function isMember(
	db: AnyDb,
	userId: string,
	serverId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ serverId: serverMembers.serverId })
		.from(serverMembers)
		.where(
			and(
				eq(serverMembers.serverId, serverId),
				eq(serverMembers.userId, userId),
				isCurrentMember,
			),
		);
	return row !== undefined;
}

/**
 * サーバー・メンバー・招待リンクの操作。サーバーの情報は、userId がメンバーのときだけ返す
 * （そうでなければ undefined・not-found。docs/context/schema.md「参加者の確認」）。
 * プロフィールを割り当てる処理（作成・参加・プロフィールの変更）は、transaction の最初に
 * user の行をロックする（プロフィールの削除と同時に起きても、使用中のプロフィールが消えないように）
 */
export function createServerService(
	db: AnyDb,
	{
		resolveMemberProfiles = serverProfileResolver,
	}: { resolveMemberProfiles?: MemberProfileResolver } = {},
): ServerService {
	return {
		create: (userId, { name, profileId }) =>
			db.transaction(async (tx) => {
				await lockUser(tx, userId);
				const profile = await findOwnProfile(tx, userId, profileId);
				if (!profile) {
					return { ok: false, reason: "invalid-profile" } as const;
				}
				const [server] = await tx
					.insert(servers)
					.values({ name, ownerUserId: userId })
					.returning({ id: servers.id, name: servers.name });
				if (!server) {
					throw new Error("サーバーを作れませんでした");
				}
				await tx
					.insert(serverMembers)
					.values({ serverId: server.id, userId, profileId: profile.id });
				return {
					ok: true,
					server: {
						...server,
						isOwner: true,
						myProfile: { id: profile.id, name: profile.name },
					},
				} as const;
			}),

		list: (userId) => selectMyServers(db, userId),

		get: (userId, serverId) => getMyServer(db, userId, serverId),

		listMembers: async (userId, serverId) => {
			const server = await getMyServer(db, userId, serverId);
			if (!server) {
				return undefined;
			}
			const rows = await db
				.select({
					userId: serverMembers.userId,
					ownerUserId: servers.ownerUserId,
					profileId: profiles.id,
					name: profiles.name,
					bio: profiles.bio,
				})
				.from(serverMembers)
				.innerJoin(servers, eq(servers.id, serverMembers.serverId))
				.innerJoin(profiles, eq(profiles.id, serverMembers.profileId))
				.where(and(eq(serverMembers.serverId, serverId), isCurrentMember))
				.orderBy(asc(serverMembers.joinedAt), asc(profiles.id));
			const shown = await resolveMemberProfiles(
				db,
				userId,
				rows.map((row) => ({
					userId: row.userId,
					serverProfile: { id: row.profileId, name: row.name, bio: row.bio },
				})),
			);
			return rows.map((row) => ({
				profile: shown.get(row.userId) ?? {
					id: row.profileId,
					name: row.name,
					bio: row.bio,
				},
				isOwner: row.userId === row.ownerUserId,
				isMe: row.userId === userId,
			}));
		},

		changeMyProfile: (userId, serverId, profileId) =>
			db.transaction(async (tx) => {
				await lockUser(tx, userId);
				if (!(await getMyServer(tx, userId, serverId))) {
					return { ok: false, reason: "not-found" } as const;
				}
				const profile = await findOwnProfile(tx, userId, profileId);
				if (!profile) {
					return { ok: false, reason: "invalid-profile" } as const;
				}
				await tx
					.update(serverMembers)
					.set({ profileId: profile.id })
					.where(
						and(
							eq(serverMembers.serverId, serverId),
							eq(serverMembers.userId, userId),
						),
					);
				const server = await getMyServer(tx, userId, serverId);
				if (!server) {
					throw new Error("サーバーを取得できませんでした");
				}
				return { ok: true, server } as const;
			}),

		createInvite: async (userId, serverId, expiresInHours) => {
			if (!(await getMyServer(db, userId, serverId))) {
				return undefined;
			}
			const [invite] = await db
				.insert(serverInvites)
				.values({
					token: generateInviteToken(),
					serverId,
					createdByUserId: userId,
					expiresAt:
						expiresInHours === null
							? null
							: sql`now() + make_interval(hours => ${expiresInHours})`,
				})
				.returning({
					token: serverInvites.token,
					expiresAt: serverInvites.expiresAt,
				});
			return invite;
		},

		findInvite: async (userId, token) => {
			const invite = await selectInvite(db, token);
			if (!invite) {
				return { ok: false, reason: "not-found" } as const;
			}
			if (invite.expired) {
				return { ok: false, reason: "expired" } as const;
			}
			return {
				ok: true,
				invite: {
					server: { id: invite.serverId, name: invite.serverName },
					isMember: await isMember(db, userId, invite.serverId),
					expiresAt: invite.expiresAt,
				},
			} as const;
		},

		join: (userId, token, profileId) =>
			db.transaction(async (tx) => {
				await lockUser(tx, userId);
				const invite = await selectInvite(tx, token);
				if (!invite) {
					return { ok: false, reason: "not-found" } as const;
				}
				if (invite.expired) {
					return { ok: false, reason: "expired" } as const;
				}
				const profile = await findOwnProfile(tx, userId, profileId);
				if (!profile) {
					return { ok: false, reason: "invalid-profile" } as const;
				}
				// 既にメンバーなら、二重に参加せず、使うプロフィールも変えない
				if (await isMember(tx, userId, invite.serverId)) {
					return {
						ok: true,
						serverId: invite.serverId,
						alreadyMember: true,
					} as const;
				}
				// 退出した行（GT-000010）があれば、その行を戻す（再参加。schema の server_members）
				await tx
					.insert(serverMembers)
					.values({ serverId: invite.serverId, userId, profileId: profile.id })
					.onConflictDoUpdate({
						target: [serverMembers.serverId, serverMembers.userId],
						set: {
							profileId: profile.id,
							leftAt: null,
							leftDisplayName: null,
							joinedAt: sql`now()`,
						},
					});
				return {
					ok: true,
					serverId: invite.serverId,
					alreadyMember: false,
				} as const;
			}),
	};
}
