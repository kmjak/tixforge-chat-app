import type { ChannelLayoutResponse, ServerResponse } from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../../../lib/get-from-server";
import { ChannelOrderEditor } from "./channel-order-editor";

export default async function ChannelOrder({
	params,
}: {
	params: Promise<{ serverId: string }>;
}) {
	const { serverId } = await params;
	const path = `/api/servers/${encodeURIComponent(serverId)}`;
	const currentPath = `/servers/${encodeURIComponent(serverId)}/channel-order`;
	// メンバーでない・存在しないサーバーは server が 404 を返し、404 の画面になる
	const [server, layout] = await Promise.all([
		loadFromServer<ServerResponse>(path, currentPath),
		loadFromServer<ChannelLayoutResponse>(`${path}/channels`, currentPath),
	]);

	return (
		<main>
			<p>
				<Link href={`/servers/${server.id}`}>← {server.name}</Link>
			</p>
			<h1>カテゴリと並び順</h1>
			{server.isOwner ? (
				<ChannelOrderEditor serverId={server.id} layout={layout} />
			) : (
				<p>カテゴリと並び順を変えられるのは、サーバーのオーナーだけです。</p>
			)}
		</main>
	);
}
