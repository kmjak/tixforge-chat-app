import type { HealthResponse } from "@chat-app/shared";

// リクエストのたびに server の状態を取得する（ビルド時には取得しない）
export const dynamic = "force-dynamic";

const serverUrl = process.env.SERVER_URL ?? "http://localhost:3001";

async function fetchHealth(): Promise<HealthResponse | null> {
	try {
		const res = await fetch(`${serverUrl}/health`, { cache: "no-store" });
		if (!res.ok) return null;
		return (await res.json()) as HealthResponse;
	} catch {
		return null;
	}
}

export default async function Home() {
	const health = await fetchHealth();

	return (
		<main>
			<h1>chat-app</h1>
			<p>server: {health ? health.status : "接続できません"}</p>
		</main>
	);
}
