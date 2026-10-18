"use client";

import {
	normalizeServerName,
	type ProfileResponse,
	type ServerResponse,
} from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../lib/api";
import { errorMessage } from "../../lib/error-messages";
import { ProfileSelect } from "../components/profile-select";

export function CreateServerForm({
	profiles,
}: {
	profiles: ProfileResponse[];
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const name = String(data.get("name"));
		// server と同じ規則で先に確かめる（最終的な判定は server が行う）
		if (normalizeServerName(name) === null) {
			setError(errorMessage("INVALID_SERVER_NAME"));
			return;
		}
		setPending(true);
		setError(null);

		const result = await callApi<ServerResponse>("/api/servers", {
			method: "POST",
			body: { name, profileId: String(data.get("profileId")) },
		});
		if (!result.ok) {
			setPending(false);
			setError(errorMessage(result.code));
			return;
		}
		router.push(`/servers/${result.data.id}`);
	}

	return (
		<form onSubmit={handleSubmit}>
			<p>
				<label>
					サーバー名（1〜100 文字）
					<br />
					<input name="name" required />
				</label>
			</p>
			<p>
				<ProfileSelect
					profiles={profiles}
					label="このサーバーで使うプロフィール"
				/>
			</p>
			{error && <p role="alert">{error}</p>}
			<button type="submit" disabled={pending}>
				作成
			</button>
		</form>
	);
}
