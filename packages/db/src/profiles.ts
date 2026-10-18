import { MAX_PROFILES } from "@chat-app/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { AnyDb } from "./client";
import { findOwnProfile, lockUser, profileColumns } from "./ownership";
import { profiles } from "./schema";
import { serverProfileUsageSource } from "./servers";

export type { AnyDb };

/** 本人に見せるプロフィールの項目 */
export type ProfileSummary = { id: string; name: string; bio: string };

/** 本人に見せるプロフィール（デフォルトかどうかを含む） */
export type Profile = ProfileSummary & { isDefault: boolean };

export { MAX_PROFILES };

/** プロフィールの割り当て先の種類（docs/context/schema.md「プロフィールの割り当て」） */
export type ProfileUsageType = "server" | "friend" | "groupDm";

/** プロフィールの使用先 1 つ。id・name は割り当て先（サーバーなど）のもの */
export type ProfileUsage = {
	profileId: string;
	type: ProfileUsageType;
	id: string;
	name: string;
};

/**
 * 指定したプロフィールの使用先を返す。割り当ての場（サーバー・フレンド・グループ DM）ごとに 1 つ作り、
 * PROFILE_USAGE_SOURCES に足す。削除の判定では transaction の中で呼ばれる
 */
export type ProfileUsageSource = (
	db: AnyDb,
	profileIds: string[],
) => Promise<ProfileUsage[]>;

/**
 * 登録済みの使用先の source。割り当ての場を作るチケットが、ここに自分の source を足す
 * （割り当てる処理は、削除と同時に起きても使用中のプロフィールが消えないよう、user の行をロックしてから行う）
 */
export const PROFILE_USAGE_SOURCES: ProfileUsageSource[] = [
	serverProfileUsageSource,
];

export type CreateProfileResult =
	| { ok: true; profile: Profile }
	| { ok: false; reason: "limit" };

export type DeleteProfileResult =
	| { ok: true }
	| { ok: false; reason: "not-found" | "default" | "in-use" };

/**
 * プロフィールの操作。どれも userId（呼び出したアカウント）のプロフィールだけを扱い、
 * 他人のもの・存在しないもの・UUID の形でない id は「無い」として扱う。
 * name・bio は検査済みの値を渡す（DB の CHECK も最後の守りとして効く）
 */
export type ProfileService = {
	findDefault: (userId: string) => Promise<ProfileSummary | undefined>;
	list: (userId: string) => Promise<Profile[]>;
	get: (userId: string, profileId: string) => Promise<Profile | undefined>;
	create: (
		userId: string,
		input: { name: string; bio: string },
	) => Promise<CreateProfileResult>;
	/** name・bio を変え、isDefault: true ならデフォルトにする。すべて 1 つの transaction で行う */
	update: (
		userId: string,
		profileId: string,
		input: { name?: string; bio?: string; isDefault?: true },
	) => Promise<Profile | undefined>;
	setDefault: (
		userId: string,
		profileId: string,
	) => Promise<Profile | undefined>;
	remove: (userId: string, profileId: string) => Promise<DeleteProfileResult>;
	listUsages: (
		userId: string,
		profileId: string,
	) => Promise<ProfileUsage[] | undefined>;
};

/** アカウントのデフォルトのプロフィールを返す。無ければ undefined */
export async function findDefaultProfile(
	db: AnyDb,
	userId: string,
): Promise<ProfileSummary | undefined> {
	const [row] = await db
		.select({ id: profiles.id, name: profiles.name, bio: profiles.bio })
		.from(profiles)
		.where(and(eq(profiles.userId, userId), eq(profiles.isDefault, true)));
	return row;
}

async function findUsages(
	db: AnyDb,
	sources: ProfileUsageSource[],
	profileId: string,
): Promise<ProfileUsage[]> {
	const results = await Promise.all(
		sources.map((source) => source(db, [profileId])),
	);
	return results.flat().filter((usage) => usage.profileId === profileId);
}

export function createProfileService(
	db: AnyDb,
	{
		usageSources = PROFILE_USAGE_SOURCES,
	}: { usageSources?: ProfileUsageSource[] } = {},
): ProfileService {
	const service: ProfileService = {
		findDefault: (userId) => findDefaultProfile(db, userId),

		list: (userId) =>
			db
				.select(profileColumns)
				.from(profiles)
				.where(eq(profiles.userId, userId))
				// デフォルトを先頭に、残りは作った順
				.orderBy(
					desc(profiles.isDefault),
					asc(profiles.createdAt),
					asc(profiles.id),
				),

		get: (userId, profileId) => findOwnProfile(db, userId, profileId),

		create: (userId, { name, bio }) =>
			db.transaction(async (tx) => {
				await lockUser(tx, userId);
				const [counted] = await tx
					.select({ n: sql<number>`count(*)::int` })
					.from(profiles)
					.where(eq(profiles.userId, userId));
				if ((counted?.n ?? 0) >= MAX_PROFILES) {
					return { ok: false, reason: "limit" } as const;
				}
				const [profile] = await tx
					.insert(profiles)
					.values({ userId, name, bio })
					.returning(profileColumns);
				if (!profile) {
					throw new Error("プロフィールを作れませんでした");
				}
				return { ok: true, profile } as const;
			}),

		update: (userId, profileId, { name, bio, isDefault }) =>
			db.transaction(async (tx) => {
				if (isDefault) {
					await lockUser(tx, userId);
				}
				const own = await findOwnProfile(tx, userId, profileId);
				if (!own) {
					return undefined;
				}
				if (isDefault && !own.isDefault) {
					// デフォルトの一意インデックスは遅延できないので、先に今のデフォルトを外す
					await tx
						.update(profiles)
						.set({ isDefault: false, updatedAt: sql`now()` })
						.where(
							and(eq(profiles.userId, userId), eq(profiles.isDefault, true)),
						);
					await tx
						.update(profiles)
						.set({ isDefault: true, updatedAt: sql`now()` })
						.where(eq(profiles.id, profileId));
				}
				if (name !== undefined || bio !== undefined) {
					await tx
						.update(profiles)
						.set({
							...(name === undefined ? {} : { name }),
							...(bio === undefined ? {} : { bio }),
							updatedAt: sql`now()`,
						})
						.where(eq(profiles.id, profileId));
				}
				return findOwnProfile(tx, userId, profileId);
			}),

		setDefault: (userId, profileId) =>
			service.update(userId, profileId, { isDefault: true }),

		remove: (userId, profileId) =>
			db.transaction(async (tx) => {
				await lockUser(tx, userId);
				const own = await findOwnProfile(tx, userId, profileId);
				if (!own) {
					return { ok: false, reason: "not-found" } as const;
				}
				if (own.isDefault) {
					return { ok: false, reason: "default" } as const;
				}
				if ((await findUsages(tx, usageSources, profileId)).length > 0) {
					return { ok: false, reason: "in-use" } as const;
				}
				await tx.delete(profiles).where(eq(profiles.id, profileId));
				return { ok: true } as const;
			}),

		listUsages: async (userId, profileId) => {
			const own = await findOwnProfile(db, userId, profileId);
			return own ? findUsages(db, usageSources, profileId) : undefined;
		},
	};
	return service;
}
