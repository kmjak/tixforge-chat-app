import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit は packages/db で実行されるので、リポジトリのルートの .env を読み込む
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
	process.loadEnvFile(rootEnv);
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema.ts",
	out: "./migrations",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "",
	},
});
