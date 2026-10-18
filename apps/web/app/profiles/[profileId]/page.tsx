import type { ProfileResponse, ProfileUsagesResponse } from "@chat-app/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFromServer } from "../../../lib/get-from-server";
import { ProfileEditor } from "./profile-editor";

export default async function ProfileDetail({
	params,
}: {
	params: Promise<{ profileId: string }>;
}) {
	const { profileId } = await params;
	const path = `/api/profiles/${encodeURIComponent(profileId)}`;
	const [profile, usages] = await Promise.all([
		getFromServer<ProfileResponse>(path),
		getFromServer<ProfileUsagesResponse>(`${path}/usages`),
	]);
	// 他人のもの・存在しないものは server が 404 を返す
	if (!profile.ok || !usages.ok) {
		if (!profile.ok && profile.status === 404) {
			notFound();
		}
		throw new Error("プロフィールを取得できませんでした");
	}

	return (
		<main>
			<p>
				<Link href="/profiles">← プロフィール一覧</Link>
			</p>
			<h1>
				{profile.data.name}
				{profile.data.isDefault && "（デフォルト）"}
			</h1>
			<ProfileEditor profile={profile.data} usages={usages.data.usages} />
		</main>
	);
}
