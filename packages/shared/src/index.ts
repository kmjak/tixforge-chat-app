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

/** 本人に見せるプロフィール（`/api/profiles` の API） */
export type ProfileResponse = {
	id: string;
	name: string;
	bio: string;
	isDefault: boolean;
};

/** `GET /api/profiles` のレスポンス。デフォルトが先頭、残りは作った順 */
export type ProfilesResponse = { profiles: ProfileResponse[] };

/** プロフィールの使用先 1 つ。id・name は割り当て先（サーバーなど）のもの */
export type ProfileUsageResponse = {
	type: "server" | "friend" | "groupDm";
	id: string;
	name: string;
};

/** `GET /api/profiles/{profileId}/usages` のレスポンス */
export type ProfileUsagesResponse = { usages: ProfileUsageResponse[] };

/** 4xx・5xx のレスポンスの共通形式（docs/context/uri.md「エラーの共通形式」） */
export type ErrorResponse = {
	/** エラーの種類（英大文字の SNAKE_CASE）。web はこれで分岐する */
	code: string;
	/** 人が読むための説明 */
	message: string;
};
export {
	BIO_MAX_LENGTH,
	isPasswordLengthValid,
	isStrongPassword,
	isValidBio,
	NAME_MAX_LENGTH,
	normalizeName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "./validation";
