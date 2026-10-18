/** server の API が返すエラーの code ごとの、画面に出すメッセージ */
const MESSAGES: Record<string, string> = {
	INVALID_EMAIL: "メールアドレスの形が正しくありません。",
	INVALID_NAME: "名前は 1〜32 文字で入力してください。",
	PASSWORD_TOO_SHORT: "パスワードは 8 文字以上にしてください。",
	PASSWORD_TOO_LONG: "パスワードは 128 文字以下にしてください。",
	PASSWORD_TOO_WEAK:
		"パスワードには、記号・英小文字・英大文字をそれぞれ 1 文字以上含めてください。",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"このメールアドレスは登録済みです。別のメールアドレスを使ってください。",
	INVALID_EMAIL_OR_PASSWORD: "メールアドレスまたはパスワードが違います。",
	INVALID_BIO: "自己紹介は 190 文字以内で入力してください。",
	PROFILE_LIMIT_REACHED: "プロフィールは 5 個まで作れます。",
	PROFILE_IS_DEFAULT: "デフォルトのプロフィールは削除できません。",
	PROFILE_IN_USE: "使用中のプロフィールは削除できません。",
	NOT_FOUND: "見つかりませんでした。ページを読み込み直してください。",
	INVALID_SERVER_NAME: "サーバー名は 1〜100 文字で入力してください。",
	INVALID_PROFILE:
		"選んだプロフィールが見つかりません。ページを読み込み直してください。",
	INVALID_EXPIRY: "有効期限を選び直してください。",
	INVITE_NOT_FOUND: "この招待リンクは見つかりません。",
	INVITE_EXPIRED: "この招待リンクは有効期限が切れています。",
};

/** code が無いとき（回数の制限の 429 など）・知らない code のときの共通のメッセージ */
export const DEFAULT_ERROR_MESSAGE =
	"うまくいきませんでした。時間をおいて、もう一度お試しください。";

/** エラーの code から、画面に出すメッセージを返す */
export function errorMessage(code: string | undefined): string {
	return code && Object.hasOwn(MESSAGES, code)
		? (MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE)
		: DEFAULT_ERROR_MESSAGE;
}
