"use client";

import {
	type CategoryResponse,
	type ChannelResponse,
	normalizeChannelName,
} from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/error-messages";

/**
 * チャンネルの作成（オーナーだけに出す）。入れるカテゴリを選べる（既定は「カテゴリなし」）。
 * 作ったら、そのチャンネルの画面へ移る
 */
export function CreateChannelForm({
	serverId,
	categories,
}: {
	serverId: string;
	categories: CategoryResponse[];
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const name = String(form.get("name"));
		const categoryId = String(form.get("categoryId") ?? "") || null;
		// server と同じ規則で先に確かめる（最終的な判定は server が行う）
		if (normalizeChannelName(name) === null) {
			setError(errorMessage("INVALID_CHANNEL_NAME"));
			return;
		}
		setPending(true);
		setError(null);
		const result = await callApi<ChannelResponse>(
			`/api/servers/${encodeURIComponent(serverId)}/channels`,
			{ method: "POST", body: { name, categoryId } },
		);
		if (!result.ok) {
			setPending(false);
			setError(errorMessage(result.code));
			return;
		}
		router.push(`/servers/${serverId}/channels/${result.data.id}`);
	}

	return (
		<form onSubmit={handleSubmit}>
			<label>
				新しいチャンネル（文字・数字・-・_ で 100 文字まで）{" "}
				<input name="name" required />
			</label>{" "}
			<label>
				カテゴリ{" "}
				<select name="categoryId" defaultValue="">
					<option value="">カテゴリなし</option>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
			</label>{" "}
			<button type="submit" disabled={pending}>
				作成
			</button>
			{error && <p role="alert">{error}</p>}
		</form>
	);
}
