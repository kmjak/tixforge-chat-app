export type ServerEnv = {
	databaseUrl: string;
	betterAuthSecret: string;
	betterAuthUrl: string;
	webOrigin: string;
};

/**
 * 環境変数を読む。DATABASE_URL と BETTER_AUTH_SECRET が無ければ、認証が動かないまま
 * 起動しないように、理由の分かるエラーを投げる。URL は開発の既定値を使う
 */
export function readEnv(env: NodeJS.ProcessEnv): ServerEnv {
	const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter(
		(key) => !env[key]?.trim(),
	);
	if (missing.length > 0) {
		throw new Error(
			`${missing.join("・")} が設定されていません。ルートの .env に設定してください（README の「環境変数」を参照）`,
		);
	}
	return {
		databaseUrl: env.DATABASE_URL?.trim() ?? "",
		betterAuthSecret: env.BETTER_AUTH_SECRET?.trim() ?? "",
		betterAuthUrl: env.BETTER_AUTH_URL?.trim() || "http://localhost:3001",
		webOrigin: env.WEB_ORIGIN?.trim() || "http://localhost:3000",
	};
}
