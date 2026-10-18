/** パスワードの長さの下限・上限（Better Auth の minPasswordLength・maxPasswordLength にも使う） */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** 名前の長さの上限（前後の空白を除いて数える。プロフィールの name と同じ） */
export const NAME_MAX_LENGTH = 32;

/** 1 つのアカウントが持てるプロフィールの数（デフォルトを含む） */
export const MAX_PROFILES = 5;

/** プロフィールの自己紹介（bio）の長さの上限 */
export const BIO_MAX_LENGTH = 190;

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
	if (length < 1 || length > NAME_MAX_LENGTH) {
		return null;
	}
	return trimmed;
}

/**
 * 自己紹介（bio）が 0〜190 文字か。前後の空白は取り除かず、入力のまま数える（改行なども自己紹介の一部）。
 * 文字数は Postgres の char_length と同じく、コードポイントで数える
 */
export function isValidBio(bio: string): boolean {
	return [...bio].length <= BIO_MAX_LENGTH;
}
