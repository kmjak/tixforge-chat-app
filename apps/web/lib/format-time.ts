const pad = (n: number) => String(n).padStart(2, "0");

/**
 * メッセージの日時を、ブラウザのタイムゾーンで表示する。今日なら時刻（14:05）、
 * それより前なら日付と時刻（2026/10/30 14:05）
 */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
	const date = new Date(iso);
	const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	if (sameDay) {
		return time;
	}
	return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${time}`;
}
