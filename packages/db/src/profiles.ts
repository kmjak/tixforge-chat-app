import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";
import { profiles } from "./schema";

/** node-postgres（本番）と PGlite（テスト）のどちらの Drizzle でも受け取れる型 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** 本人に見せるプロフィールの項目 */
export type ProfileSummary = { id: string; name: string; bio: string };

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
