import type { ProfileResponse, ProfileUsagesResponse } from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../../lib/get-from-server";
import { ProfileEditor } from "./profile-editor";

export default async function ProfileDetail({
	params,
}: {
	params: Promise<{ profileId: string }>;
}) {
	const { profileId } = await params;
	const path = `/api/profiles/${encodeURIComponent(profileId)}`;
	const currentPath = `/profiles/${encodeURIComponent(profileId)}`;
	// 他人のもの・存在しないもの（使用先を取る前に消された場合も）は server が 404 を返し、404 の画面になる
	const [profile, { usages }] = await Promise.all([
		loadFromServer<ProfileResponse>(path, currentPath),
		loadFromServer<ProfileUsagesResponse>(`${path}/usages`, currentPath),
	]);

	return (
		<main>
			<p>
				<Link href="/profiles">← プロフィール一覧</Link>
			</p>
			<h1>
				{profile.name}
				{profile.isDefault && "（デフォルト）"}
			</h1>
			<ProfileEditor profile={profile} usages={usages} />
		</main>
	);
}
