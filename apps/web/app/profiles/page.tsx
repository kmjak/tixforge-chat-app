import { MAX_PROFILES, type ProfilesResponse } from "@chat-app/shared";
import Link from "next/link";
import { loadFromServer } from "../../lib/get-from-server";
import { CreateProfileForm } from "./create-profile-form";

export default async function Profiles() {
	const { profiles } = await loadFromServer<ProfilesResponse>(
		"/api/profiles",
		"/profiles",
	);

	return (
		<main>
			<p>
				<Link href="/home">← ホーム</Link>
			</p>
			<h1>
				プロフィール（{profiles.length} / {MAX_PROFILES}）
			</h1>
			<ul>
				{profiles.map((profile) => (
					<li key={profile.id}>
						<Link href={`/profiles/${profile.id}`}>
							{profile.name}
							{profile.isDefault && "（デフォルト）"}
						</Link>
					</li>
				))}
			</ul>
			<h2>新しいプロフィール</h2>
			{profiles.length < MAX_PROFILES ? (
				<CreateProfileForm />
			) : (
				<p>プロフィールは {MAX_PROFILES} 個まで作れます。</p>
			)}
		</main>
	);
}
