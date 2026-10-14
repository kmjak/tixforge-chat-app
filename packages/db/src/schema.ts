// テーブルの定義。テーブルは後のチケットでここに追加する
import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---- Better Auth のテーブル ----
// 列は Better Auth が決める。テーブル名・TS のプロパティ名は Better Auth のモデル名・フィールド名のままにする
// （drizzleAdapter がこの名前で引くため）。id は DB で UUID を作る（Better Auth の generateId: "uuid"）

/** アカウント（docs/context/schema/user.md） */
export const user = pgTable("user", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

/** ログインのセッション（docs/context/schema/session.md） */
export const session = pgTable(
	"session",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

/** ログインの方法とパスワード（docs/context/schema/account.md） */
export const account = pgTable(
	"account",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

/** 確認用のトークン（docs/context/schema/verification.md。MVP では使わない） */
export const verification = pgTable(
	"verification",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ---- 自前のテーブル ----

/**
 * プロフィール（docs/context/schema/profiles.md）。
 * デフォルトのプロフィールは、user への INSERT の trigger で作る（マイグレーション 0002）
 */
export const profiles = pgTable(
	"profiles",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id),
		name: varchar("name", { length: 32 }).notNull(),
		bio: varchar("bio", { length: 190 }).notNull().default(""),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("profiles_user_id_idx").on(table.userId),
		uniqueIndex("profiles_user_id_default_idx")
			.on(table.userId)
			.where(sql`${table.isDefault} = true`),
		check(
			"profiles_name_length",
			sql`char_length(${table.name}) between 1 and 32`,
		),
		check("profiles_bio_length", sql`char_length(${table.bio}) <= 190`),
	],
);
