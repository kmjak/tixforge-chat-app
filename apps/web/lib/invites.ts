import { INVITE_EXPIRY_HOURS, type InviteExpiryHours } from "@chat-app/shared";

/** 招待リンクの有効期限の選択肢（画面の表示用）。null は無制限 */
export const INVITE_EXPIRY_OPTIONS: {
	value: InviteExpiryHours;
	label: string;
}[] = [
	...INVITE_EXPIRY_HOURS.map((hours) => ({
		value: hours,
		label: `${hours} 時間`,
	})),
	{ value: null, label: "無制限" },
];

/** select の値（文字列）から有効期限を戻す。"none" は無制限 */
export function parseExpiryOption(
	value: string,
): InviteExpiryHours | undefined {
	if (value === "none") {
		return null;
	}
	const hours = Number(value);
	return (INVITE_EXPIRY_HOURS as readonly number[]).includes(hours)
		? (hours as InviteExpiryHours)
		: undefined;
}

/** 招待の画面の URL（web の /invites/{token}） */
export function inviteUrl(origin: string, token: string): string {
	return `${origin}/invites/${encodeURIComponent(token)}`;
}

/** 有効期限の表示。null は「無制限」 */
export function formatExpiresAt(expiresAt: string | null): string {
	if (expiresAt === null) {
		return "無制限";
	}
	return new Date(expiresAt).toLocaleString("ja-JP", {
		timeZone: "Asia/Tokyo",
	});
}
