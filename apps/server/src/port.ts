const DEFAULT_PORT = 3001;

/** 環境変数 PORT の値をポート番号にする。未設定・空なら既定値、不正な値ならエラーにする */
export function parsePort(value: string | undefined): number {
	if (value === undefined || value.trim() === "") return DEFAULT_PORT;

	const trimmed = value.trim();
	// Number() は 0x1F・1e3 なども数値にしてしまうので、10 進の数字だけを受け付ける
	const port = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(
			`PORT が不正です（1〜65535 の整数を指定してください）: ${value}`,
		);
	}
	return port;
}
