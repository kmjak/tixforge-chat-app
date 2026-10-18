import type { ChannelResponse, ServerResponse } from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../../../../lib/get-from-server";
import { ChannelSettings } from "./channel-settings";

export default async function ChannelDetail({
	params,
}: {
	params: Promise<{ serverId: string; channelId: string }>;
}) {
	const { serverId, channelId } = await params;
	const serverPath = `/api/servers/${encodeURIComponent(serverId)}`;
	const currentPath = `/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}`;
	// メンバーでない・存在しない・削除したチャンネルは server が 404 を返し、404 の画面になる
	const [server, channel] = await Promise.all([
		loadFromServer<ServerResponse>(serverPath, currentPath),
		loadFromServer<ChannelResponse>(
			`${serverPath}/channels/${encodeURIComponent(channelId)}`,
			currentPath,
		),
	]);

	return (
		<main>
			<p>
				<Link href={`/servers/${server.id}`}>← {server.name}</Link>
			</p>
			<h1>
				# {channel.name}
				{channel.isDefault && "（既定）"}
			</h1>
			{server.isOwner && (
				<ChannelSettings serverId={server.id} channel={channel} />
			)}
			{/* メッセージは GT-000014 で足す */}
		</main>
	);
}
