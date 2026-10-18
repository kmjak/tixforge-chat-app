import type { InviteResponse, ProfilesResponse } from "@chat-app/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { errorMessage } from "../../../lib/error-messages";
import { getFromServer, loadFromServer } from "../../../lib/get-from-server";
import { formatExpiresAt } from "../../../lib/invites";
import { withRedirect } from "../../../lib/redirect";
import { JoinForm } from "./join-form";

export default async function Invite({
	params,
}: {
	params: Promise<{ token: string }>;
}) {
	const { token } = await params;
	const currentPath = `/invites/${encodeURIComponent(token)}`;
	const result = await getFromServer<InviteResponse>(
		`/api/invites/${encodeURIComponent(token)}`,
	);

	if (!result.ok) {
		if (result.status === 401) {
			redirect(withRedirect("/sign-in", currentPath));
		}
		// 期限切れ（410）・存在しない（404）は、その旨を表示する
		const message =
			result.status === 410
				? errorMessage("INVITE_EXPIRED")
				: result.status === 404
					? errorMessage("INVITE_NOT_FOUND")
					: errorMessage(undefined);
		return (
			<main>
				<h1>招待</h1>
				<p role="alert">{message}</p>
				<p>
					<Link href="/servers">サーバー一覧へ</Link>
				</p>
			</main>
		);
	}

	const invite = result.data;
	if (invite.isMember) {
		return (
			<main>
				<h1>{invite.server.name} への招待</h1>
				<p>このサーバーには既に参加しています。</p>
				<p>
					<Link href={`/servers/${invite.server.id}`}>サーバーを開く</Link>
				</p>
			</main>
		);
	}

	const { profiles } = await loadFromServer<ProfilesResponse>(
		"/api/profiles",
		currentPath,
	);
	return (
		<main>
			<h1>{invite.server.name} への招待</h1>
			<p>有効期限：{formatExpiresAt(invite.expiresAt)}</p>
			<JoinForm token={token} profiles={profiles} />
		</main>
	);
}
