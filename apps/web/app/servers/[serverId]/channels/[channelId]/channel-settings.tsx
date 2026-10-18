"use client";

import { type ChannelResponse, normalizeChannelName } from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../../../lib/api";
import { errorMessage } from "../../../../../lib/error-messages";

/** チャンネルの名前の変更と削除（オーナーだけに出す） */
export function ChannelSettings({
	serverId,
	channel,
}: {
	serverId: string;
	channel: ChannelResponse;
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const path = `/api/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channel.id)}`;

	async function handleRename(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = String(new FormData(event.currentTarget).get("name"));
		if (normalizeChannelName(name) === null) {
			setError(errorMessage("INVALID_CHANNEL_NAME"));
			return;
		}
		setPending(true);
		setError(null);
		const result = await callApi<ChannelResponse>(path, {
			method: "PATCH",
			body: { name },
		});
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		router.refresh();
	}

	async function handleDelete() {
		setPending(true);
		setError(null);
		const result = await callApi(path, { method: "DELETE" });
		if (!result.ok) {
			setPending(false);
			setError(errorMessage(result.code));
			return;
		}
		router.replace(`/servers/${serverId}`);
		router.refresh();
	}

	return (
		<>
			<h2>チャンネルの設定</h2>
			{/* key で、変更した名前に入力欄を合わせ直す */}
			<form key={channel.name} onSubmit={handleRename}>
				<label>
					名前 <input name="name" defaultValue={channel.name} required />
				</label>{" "}
				<button type="submit" disabled={pending}>
					変更
				</button>
			</form>
			{channel.isDefault ? (
				<p>既定のチャンネルは削除できません。</p>
			) : (
				<p>
					<button type="button" disabled={pending} onClick={handleDelete}>
						削除
					</button>
				</p>
			)}
			{error && <p role="alert">{error}</p>}
		</>
	);
}
