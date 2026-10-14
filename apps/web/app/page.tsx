import { fetchHealth } from "../lib/health";

// リクエストのたびに server の状態を取得する（ビルド時には取得しない）
export const dynamic = "force-dynamic";

const serverUrl = process.env.SERVER_URL ?? "http://localhost:3001";

export default async function Home() {
	const health = await fetchHealth(serverUrl);

	return (
		<main>
			<h1>chat-app</h1>
			<p>server: {health ? "ok" : "接続できません"}</p>
			{health && <p>db: {health.db === "ok" ? "ok" : "接続できません"}</p>}
		</main>
	);
}
