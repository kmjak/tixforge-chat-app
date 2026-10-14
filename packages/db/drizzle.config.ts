import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit は packages/db で実行されるので、リポジトリのルートの .env を読み込む
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
	process.loadEnvFile(rootEnv);
}

// migrate は DB に接続するので、DATABASE_URL が無ければ理由の分かるエラーで止める（generate は接続しない）
if (!process.env.DATABASE_URL?.trim() && process.argv.includes("migrate")) {
	throw new Error(
		"DATABASE_URL が設定されていません。ルートに .env を作り、Neon の接続文字列を入れてください（README の「DB」を参照）",
	);
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema.ts",
	out: "./migrations",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "",
	},
});
