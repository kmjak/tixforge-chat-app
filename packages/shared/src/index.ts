/** `GET /health` のレスポンス。DB に接続できれば 200 で ok、できなければ 503 で error */
export type HealthResponse =
	| { status: "ok"; db: "ok" }
	| { status: "error"; db: "error" };
