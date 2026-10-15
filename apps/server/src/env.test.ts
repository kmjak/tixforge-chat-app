import { readEnv } from "./env";

const SECRET = "s".repeat(32);

describe("readEnv", () => {
	it("設定された値を返す", () => {
		expect(
			readEnv({
				DATABASE_URL: "postgres://db",
				BETTER_AUTH_SECRET: SECRET,
				BETTER_AUTH_URL: "https://api.example.com",
				WEB_ORIGIN: "https://example.com",
			}),
		).toEqual({
			databaseUrl: "postgres://db",
			betterAuthSecret: SECRET,
			betterAuthUrl: "https://api.example.com",
			webOrigin: "https://example.com",
		});
	});

	it("URL が無ければ開発の既定値を使う", () => {
		expect(
			readEnv({ DATABASE_URL: "postgres://db", BETTER_AUTH_SECRET: SECRET }),
		).toMatchObject({
			betterAuthUrl: "http://localhost:3001",
			webOrigin: "http://localhost:3000",
		});
	});

	it.each([
		["DATABASE_URL", { BETTER_AUTH_SECRET: SECRET }],
		[
			"BETTER_AUTH_SECRET",
			{ DATABASE_URL: "postgres://db", BETTER_AUTH_SECRET: " " },
		],
	])("%s が無ければ、理由の分かるエラーを投げる", (key, env) => {
		expect(() => readEnv(env)).toThrow(`${key} が設定されていません`);
	});

	it("BETTER_AUTH_SECRET が 32 文字より短ければ、理由の分かるエラーを投げる", () => {
		expect(() =>
			readEnv({
				DATABASE_URL: "postgres://db",
				BETTER_AUTH_SECRET: "s".repeat(31),
			}),
		).toThrow("BETTER_AUTH_SECRET は 32 文字以上にしてください");
	});
});
