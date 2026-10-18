import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "./client";
import type { Profile } from "./profiles";
import { profiles, serverMembers, servers, user } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID の形か。URL や本文から来た id を、DB の uuid の列と比べる前に確かめる（形が違うと DB がエラーにする） */
export function isUuid(value: string): boolean {
	return UUID.test(value);
}

/** 本人に見せるプロフィールの列 */
export const profileColumns = {
	id: profiles.id,
	name: profiles.name,
	bio: profiles.bio,
	isDefault: profiles.isDefault,
};

/** userId のアカウントのプロフィールなら返す。他人のもの・存在しないもの・UUID の形でない id は undefined */
export async function findOwnProfile(
	db: AnyDb,
	userId: string,
	profileId: string,
): Promise<Profile | undefined> {
	if (!isUuid(profileId)) {
		return undefined;
	}
	const [row] = await db
		.select(profileColumns)
		.from(profiles)
		.where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
	return row;
}

/**
 * user の行をロックする。同じアカウントのプロフィールの作成・切り替え・削除と、プロフィールの割り当て
 * （サーバーへの参加など）を順番に並べ、数の上限・デフォルトが 1 つ・使用中の判定が同時の操作で
 * 崩れないようにする（docs/context/schema.md「命名と型の規則」「プロフィールの割り当て」）
 */
export async function lockUser(tx: AnyDb, userId: string): Promise<void> {
	await tx
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, userId))
		.for("update");
}

/**
 * servers の行をロックする。サーバーの中の上限の数（チャンネルは 10 個まで など）を、同時の作成で
 * 超えないように、数える前に取る（docs/context/schema.md「命名と型の規則」）
 */
export async function lockServer(tx: AnyDb, serverId: string): Promise<void> {
	await tx
		.select({ id: servers.id })
		.from(servers)
		.where(eq(servers.id, serverId))
		.for("update");
}

/**
 * userId がそのサーバーの今のメンバー（退出していない）なら、オーナーかどうかを返す。
 * メンバーでない・存在しない・UUID の形でない id は undefined
 */
export async function findServerMembership(
	db: AnyDb,
	userId: string,
	serverId: string,
): Promise<{ isOwner: boolean } | undefined> {
	if (!isUuid(serverId)) {
		return undefined;
	}
	const [row] = await db
		.select({ ownerUserId: servers.ownerUserId })
		.from(serverMembers)
		.innerJoin(servers, eq(servers.id, serverMembers.serverId))
		.where(
			and(
				eq(serverMembers.serverId, serverId),
				eq(serverMembers.userId, userId),
				isNull(serverMembers.leftAt),
			),
		);
	return row ? { isOwner: row.ownerUserId === userId } : undefined;
}
