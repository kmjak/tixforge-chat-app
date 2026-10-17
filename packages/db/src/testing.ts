import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type TestDb = PgliteDatabase<typeof schema> & { $client: PGlite };

/**
 * テスト用に、メモリ上の Postgres（PGlite）に本物のマイグレーションを当てた DB を作る。
 * Neon やネットワーク無しで、制約・trigger・transaction まで確かめるために使う。
 * 使い終わったら `db.$client.close()` で閉じる
 */
export async function createTestDb(): Promise<TestDb> {
	const db = drizzle(new PGlite(), { schema });
	await migrate(db, {
		migrationsFolder: resolve(__dirname, "../migrations"),
	});
	return db;
}
