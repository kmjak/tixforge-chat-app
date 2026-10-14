import { readEnv } from "./env";

describe("readEnv", () => {
	it("設定された値を返す", () => {
		expect(
			readEnv({
				DATABASE_URL: "postgres://db",
				BETTER_AUTH_SECRET: "secret",
				BETTER_AUTH_URL: "https://api.example.com",
				WEB_ORIGIN: "https://example.com",
			}),
		).toEqual({
			databaseUrl: "postgres://db",
			betterAuthSecret: "secret",
			betterAuthUrl: "https://api.example.com",
			webOrigin: "https://example.com",
		});
	});

	it("URL が無ければ開発の既定値を使う", () => {
		expect(
			readEnv({ DATABASE_URL: "postgres://db", BETTER_AUTH_SECRET: "secret" }),
		).toMatchObject({
			betterAuthUrl: "http://localhost:3001",
			webOrigin: "http://localhost:3000",
		});
	});

	it.each([
		["DATABASE_URL", { BETTER_AUTH_SECRET: "secret" }],
		[
			"BETTER_AUTH_SECRET",
			{ DATABASE_URL: "postgres://db", BETTER_AUTH_SECRET: " " },
		],
	])("%s が無ければ、理由の分かるエラーを投げる", (key, env) => {
		expect(() => readEnv(env)).toThrow(`${key} が設定されていません`);
	});
});
