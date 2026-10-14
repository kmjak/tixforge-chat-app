/** `GET /health` のレスポンス。DB に接続できれば 200 で ok、できなければ 503 で error */
export type HealthResponse =
	| { status: "ok"; db: "ok" }
	| { status: "error"; db: "error" };
export {
	isPasswordLengthValid,
	isStrongPassword,
	NAME_MAX_LENGTH,
	normalizeName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "./validation";
