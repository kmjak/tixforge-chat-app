/** BETTER_AUTH_SECRET の長さの下限（短い秘密の値でセッションに署名しないように） */
export const MIN_SECRET_LENGTH = 32;

export type ServerEnv = {
	databaseUrl: string;
	betterAuthSecret: string;
	betterAuthUrl: string;
	webOrigin: string;
};

/**
 * 環境変数を読む。DATABASE_URL と BETTER_AUTH_SECRET が無い、または BETTER_AUTH_SECRET が
 * 32 文字より短ければ、認証が動かない・弱いまま起動しないように、理由の分かるエラーを投げる。
 * URL は開発の既定値を使う
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
	const secret = env.BETTER_AUTH_SECRET?.trim() ?? "";
	if (secret.length < MIN_SECRET_LENGTH) {
		throw new Error(
			`BETTER_AUTH_SECRET は ${MIN_SECRET_LENGTH} 文字以上にしてください（\`openssl rand -base64 32\` などで作る）`,
		);
	}
	return {
		databaseUrl: env.DATABASE_URL?.trim() ?? "",
		betterAuthSecret: secret,
		betterAuthUrl: env.BETTER_AUTH_URL?.trim() || "http://localhost:3001",
		webOrigin: env.WEB_ORIGIN?.trim() || "http://localhost:3000",
	};
}
