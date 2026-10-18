/** パスワードの長さの下限・上限（Better Auth の minPasswordLength・maxPasswordLength にも使う） */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** 名前の長さの上限（前後の空白を除いて数える。プロフィールの name と同じ） */
export const NAME_MAX_LENGTH = 32;

/** 1 つのアカウントが持てるプロフィールの数（デフォルトを含む） */
export const MAX_PROFILES = 5;

/** プロフィールの自己紹介（bio）の長さの上限 */
export const BIO_MAX_LENGTH = 190;

/** Postgres の文字列に入れられない文字（U+0000）。含む値は、DB のエラー（500）にせず入力の誤りにする */
const NUL = "\u0000";

/** 記号として数える文字（ASCII の記号 32 字） */
const SYMBOL = /[!-/:-@[-`{-~]/;

/**
 * パスワードに、記号・英小文字・英大文字がそれぞれ 1 文字以上あるか。
 * 長さは見ない（長さの誤りは Better Auth が PASSWORD_TOO_SHORT・PASSWORD_TOO_LONG で返す）
 */
export function isStrongPassword(password: string): boolean {
	return (
		/[a-z]/.test(password) && /[A-Z]/.test(password) && SYMBOL.test(password)
	);
}

/** パスワードの長さが、下限と上限の間にあるか */
export function isPasswordLengthValid(password: string): boolean {
	return (
		password.length >= PASSWORD_MIN_LENGTH &&
		password.length <= PASSWORD_MAX_LENGTH
	);
}

/**
 * 名前の前後の空白を除いた値を返す。除いた後が 1〜32 文字でなければ null を返す。
 * 文字数は Postgres の char_length と同じく、コードポイントで数える
 */
export function normalizeName(name: string): string | null {
	const trimmed = name.trim();
	const length = [...trimmed].length;
	if (length < 1 || length > NAME_MAX_LENGTH || trimmed.includes(NUL)) {
		return null;
	}
	return trimmed;
}

/**
 * 自己紹介（bio）が 0〜190 文字か。前後の空白は取り除かず、入力のまま数える（改行なども自己紹介の一部）。
 * 文字数は Postgres の char_length と同じく、コードポイントで数える
 */
export function isValidBio(bio: string): boolean {
	return [...bio].length <= BIO_MAX_LENGTH && !bio.includes(NUL);
}

/** サーバー名の長さの上限（前後の空白を除いて数える） */
export const SERVER_NAME_MAX_LENGTH = 100;

/**
 * サーバー名の前後の空白を除いた値を返す。除いた後が 1〜100 文字でなければ null を返す。
 * 文字数はコードポイントで数える
 */
export function normalizeServerName(name: string): string | null {
	const trimmed = name.trim();
	const length = [...trimmed].length;
	if (length < 1 || length > SERVER_NAME_MAX_LENGTH || trimmed.includes(NUL)) {
		return null;
	}
	return trimmed;
}

/** 招待リンクの有効期限の選択肢（時間）。null は無制限 */
export const INVITE_EXPIRY_HOURS = [1, 6, 12, 24, 48] as const;

export type InviteExpiryHours = (typeof INVITE_EXPIRY_HOURS)[number] | null;

/** 招待リンクの有効期限として受け付ける値か（1・6・12・24・48 時間か、無制限の null） */
export function isInviteExpiryHours(
	value: unknown,
): value is InviteExpiryHours {
	return (
		value === null ||
		(INVITE_EXPIRY_HOURS as readonly unknown[]).includes(value)
	);
}
