"use client";

import {
	isValidBio,
	normalizeName,
	type ProfileResponse,
} from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../lib/api";
import { errorMessage } from "../../lib/error-messages";

export function CreateProfileForm() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const name = String(data.get("name"));
		const bio = String(data.get("bio"));

		// server と同じ規則で先に確かめる（最終的な判定は server が行う）
		if (normalizeName(name) === null) {
			setError(errorMessage("INVALID_NAME"));
			return;
		}
		if (!isValidBio(bio)) {
			setError(errorMessage("INVALID_BIO"));
			return;
		}
		setPending(true);
		setError(null);

		const result = await callApi<ProfileResponse>("/api/profiles", {
			method: "POST",
			body: { name, bio },
		});
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		form.reset();
		router.refresh();
	}

	return (
		<form onSubmit={handleSubmit}>
			<p>
				<label>
					名前（1〜32 文字）
					<br />
					<input name="name" required />
				</label>
			</p>
			<p>
				<label>
					自己紹介（190 文字まで）
					<br />
					<textarea name="bio" rows={3} />
				</label>
			</p>
			{error && <p role="alert">{error}</p>}
			<button type="submit" disabled={pending}>
				作成
			</button>
		</form>
	);
}
