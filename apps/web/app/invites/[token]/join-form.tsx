"use client";

import type { JoinServerResponse, ProfileResponse } from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/error-messages";
import { ProfileSelect } from "../../components/profile-select";

export function JoinForm({
	token,
	profiles,
}: {
	token: string;
	profiles: ProfileResponse[];
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		setPending(true);
		setError(null);
		const result = await callApi<JoinServerResponse>(
			`/api/invites/${encodeURIComponent(token)}/join`,
			{ method: "POST", body: { profileId: String(data.get("profileId")) } },
		);
		if (!result.ok) {
			setPending(false);
			setError(errorMessage(result.code));
			return;
		}
		router.push(`/servers/${result.data.serverId}`);
	}

	return (
		<form onSubmit={handleSubmit}>
			<p>
				<ProfileSelect
					profiles={profiles}
					label="このサーバーで使うプロフィール"
				/>
			</p>
			{error && <p role="alert">{error}</p>}
			<button type="submit" disabled={pending}>
				参加
			</button>
		</form>
	);
}
