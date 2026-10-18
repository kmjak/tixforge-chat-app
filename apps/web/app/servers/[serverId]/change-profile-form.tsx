"use client";

import type { ProfileResponse, ServerResponse } from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/error-messages";
import { ProfileSelect } from "../../components/profile-select";

export function ChangeProfileForm({
	serverId,
	profiles,
	currentProfileId,
}: {
	serverId: string;
	profiles: ProfileResponse[];
	currentProfileId: string;
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		setPending(true);
		setError(null);
		const result = await callApi<ServerResponse>(
			`/api/servers/${encodeURIComponent(serverId)}/members/me`,
			{ method: "PATCH", body: { profileId: String(data.get("profileId")) } },
		);
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		router.refresh();
	}

	return (
		// key で、保存した値に選択を合わせ直す
		<form key={currentProfileId} onSubmit={handleSubmit}>
			<ProfileSelect
				profiles={profiles}
				selectedId={currentProfileId}
				label="プロフィール"
			/>{" "}
			<button type="submit" disabled={pending}>
				変更
			</button>
			{error && <p role="alert">{error}</p>}
		</form>
	);
}
