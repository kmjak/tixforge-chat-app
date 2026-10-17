/** `GET /health` のレスポンス。DB に接続できれば 200 で ok、できなければ 503 で error */
export type HealthResponse =
	| { status: "ok"; db: "ok" }
	| { status: "error"; db: "error" };

/** `GET /api/me` のレスポンス。ログインしているアカウント（本人）の情報 */
export type MeResponse = {
	id: string;
	email: string;
	defaultProfile: { id: string; name: string; bio: string };
};

/** 4xx・5xx のレスポンスの共通形式（docs/context/uri.md「エラーの共通形式」） */
export type ErrorResponse = {
	/** エラーの種類（英大文字の SNAKE_CASE）。web はこれで分岐する */
	code: string;
	/** 人が読むための説明 */
	message: string;
};
export {
	isPasswordLengthValid,
	isStrongPassword,
	NAME_MAX_LENGTH,
	normalizeName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "./validation";
