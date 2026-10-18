import { cookies } from "next/headers";
import { type ServerGetResult, serverGet } from "./server-api";

/** server の URL（web の server 側から呼ぶとき） */
const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3001";

/** ページの表示のときに、ブラウザの cookie を付けて server の API を GET する */
export async function getFromServer<T>(
	path: string,
): Promise<ServerGetResult<T>> {
	const cookie = (await cookies()).toString();
	return serverGet<T>(SERVER_URL, path, cookie);
}
