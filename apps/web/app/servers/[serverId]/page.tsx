import type {
	ProfilesResponse,
	ServerMembersResponse,
	ServerResponse,
} from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../../lib/get-from-server";
import { ChangeProfileForm } from "./change-profile-form";
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
	const [server, { members }, { profiles }] = await Promise.all([
		loadFromServer<ServerResponse>(path, currentPath),
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
