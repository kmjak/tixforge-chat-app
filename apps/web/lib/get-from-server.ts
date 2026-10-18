import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveServerGet, serverGet } from "./server-api";

/** server の URL（web の server 側から呼ぶとき） */
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";

/**
 * ページの表示のときに、ブラウザの cookie を付けて server の API を GET し、本文を返す。
 * 401 ならサインインへリダイレクトし（currentPath に戻る）、404 なら 404 の画面にする。
 * それ以外の失敗は例外（エラーの画面）
 */
export async function loadFromServer<T>(
	path: string,
	currentPath: string,
): Promise<T> {
	const cookie = (await cookies()).toString();
	const outcome = resolveServerGet(
		await serverGet<T>(SERVER_URL, path, cookie),
		currentPath,
	);
	switch (outcome.type) {
		case "data":
			return outcome.data;
		case "redirect":
			redirect(outcome.to);
			break;
		case "not-found":
			notFound();
			break;
	}
	throw new Error(`${path} を取得できませんでした（${outcome.status}）`);
}
