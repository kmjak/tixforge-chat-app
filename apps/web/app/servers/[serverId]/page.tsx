import type {
	ChannelLayoutResponse,
	ChannelResponse,
	ProfilesResponse,
	ServerMembersResponse,
	ServerResponse,
} from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../../lib/get-from-server";
import { ChangeProfileForm } from "./change-profile-form";
import { CreateChannelForm } from "./create-channel-form";
import { CreateInviteForm } from "./create-invite-form";

export default async function ServerDetail({
	params,
}: {
	params: Promise<{ serverId: string }>;
}) {
	const { serverId } = await params;
	const path = `/api/servers/${encodeURIComponent(serverId)}`;
	const currentPath = `/servers/${encodeURIComponent(serverId)}`;
	// メンバーでない・存在しないサーバーは server が 404 を返し、404 の画面になる
	const [server, layout, { members }, { profiles }] = await Promise.all([
		loadFromServer<ServerResponse>(path, currentPath),
		loadFromServer<ChannelLayoutResponse>(`${path}/channels`, currentPath),
		loadFromServer<ServerMembersResponse>(`${path}/members`, currentPath),
		loadFromServer<ProfilesResponse>("/api/profiles", currentPath),
	]);

	return (
		<main>
			<p>
				<Link href="/servers">← サーバー一覧</Link>
			</p>
			<h1>
				{server.name}
				{server.isOwner && "（オーナー）"}
			</h1>

			<h2>チャンネル</h2>
			{/* カテゴリに属さないチャンネルを先に、続けてカテゴリの見出しと中のチャンネル */}
			<ChannelList serverId={server.id} channels={layout.channels} />
			{layout.categories.map((category) => (
				<section key={category.id}>
					<h3>{category.name}</h3>
					<ChannelList serverId={server.id} channels={category.channels} />
				</section>
			))}
			{server.isOwner && (
				<>
					<CreateChannelForm
						serverId={server.id}
						categories={layout.categories.map(({ id, name }) => ({
							id,
							name,
						}))}
					/>
					<p>
						<Link href={`/servers/${server.id}/channel-order`}>
							カテゴリと並び順を編集する
						</Link>
					</p>
				</>
			)}

			<h2>このサーバーで使うプロフィール</h2>
			<ChangeProfileForm
				serverId={server.id}
				profiles={profiles}
				currentProfileId={server.myProfile.id}
			/>

			<h2>メンバー（{members.length}）</h2>
			<ul>
				{members.map((member) => (
					<li key={member.profile.id}>
						{member.profile.name}
						{member.isOwner && "（オーナー）"}
						{member.isMe && "（あなた）"}
						{member.profile.bio && ` — ${member.profile.bio}`}
					</li>
				))}
			</ul>

			<h2>招待リンク</h2>
			<CreateInviteForm serverId={server.id} />
		</main>
	);
}

function ChannelList({
	serverId,
	channels,
}: {
	serverId: string;
	channels: ChannelResponse[];
}) {
	return (
		<ul>
			{channels.map((channel) => (
				<li key={channel.id}>
					<Link href={`/servers/${serverId}/channels/${channel.id}`}>
						# {channel.name}
					</Link>
					{channel.isDefault && "（既定）"}
				</li>
			))}
		</ul>
	);
}
