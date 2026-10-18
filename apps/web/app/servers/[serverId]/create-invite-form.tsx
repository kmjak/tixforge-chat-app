"use client";

import type { CreatedInviteResponse } from "@chat-app/shared";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/error-messages";
import {
	formatExpiresAt,
	INVITE_EXPIRY_OPTIONS,
	inviteUrl,
	parseExpiryOption,
} from "../../../lib/invites";

export function CreateInviteForm({ serverId }: { serverId: string }) {
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [invite, setInvite] = useState<CreatedInviteResponse | null>(null);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const expiresInHours = parseExpiryOption(String(data.get("expiresIn")));
		if (expiresInHours === undefined) {
			setError(errorMessage("INVALID_EXPIRY"));
			return;
		}
		setPending(true);
		setError(null);
		const result = await callApi<CreatedInviteResponse>(
			`/api/servers/${encodeURIComponent(serverId)}/invites`,
			{ method: "POST", body: { expiresInHours } },
		);
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		setInvite(result.data);
	}

	return (
		<>
			<form onSubmit={handleSubmit}>
				<label>
					有効期限{" "}
					<select name="expiresIn" defaultValue="24">
						{INVITE_EXPIRY_OPTIONS.map((option) => (
							<option
								key={option.label}
								value={option.value === null ? "none" : String(option.value)}
							>
								{option.label}
							</option>
						))}
					</select>
				</label>{" "}
				<button type="submit" disabled={pending}>
					招待リンクを作る
				</button>
			</form>
			{error && <p role="alert">{error}</p>}
			{invite && (
				<p>
					招待リンク：
					<input
						readOnly
						size={80}
						value={inviteUrl(window.location.origin, invite.token)}
						onFocus={(event) => event.currentTarget.select()}
					/>
					<br />
					有効期限：{formatExpiresAt(invite.expiresAt)}
				</p>
			)}
		</>
	);
}
