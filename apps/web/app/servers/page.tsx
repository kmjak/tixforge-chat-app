import type { ProfilesResponse, ServersResponse } from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../lib/get-from-server";
import { CreateServerForm } from "./create-server-form";

export default async function Servers() {
	const [{ servers }, { profiles }] = await Promise.all([
		loadFromServer<ServersResponse>("/api/servers", "/servers"),
		loadFromServer<ProfilesResponse>("/api/profiles", "/servers"),
	]);

	return (
		<main>
			<p>
				<Link href="/home">← ホーム</Link>
			</p>
			<h1>サーバー</h1>
			{servers.length === 0 ? (
				<p>参加しているサーバーはありません。</p>
			) : (
				<ul>
					{servers.map((server) => (
						<li key={server.id}>
							<Link href={`/servers/${server.id}`}>{server.name}</Link>
							{server.isOwner && "（オーナー）"}
							{" — "}
							{server.myProfile.name} で参加中
						</li>
					))}
				</ul>
			)}
			<h2>新しいサーバー</h2>
			<CreateServerForm profiles={profiles} />
		</main>
	);
}
