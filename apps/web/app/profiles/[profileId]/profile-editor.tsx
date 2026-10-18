"use client";

import {
	isValidBio,
	normalizeName,
	type ProfileResponse,
	type ProfileUsageResponse,
} from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { callApi } from "../../../lib/api";
import { errorMessage } from "../../../lib/error-messages";

const USAGE_LABELS: Record<ProfileUsageResponse["type"], string> = {
	server: "サーバー",
	friend: "フレンド",
	groupDm: "グループ DM",
};

export function ProfileEditor({
	profile,
	usages,
}: {
	profile: ProfileResponse;
	usages: ProfileUsageResponse[];
}) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const path = `/api/profiles/${encodeURIComponent(profile.id)}`;

	/** 操作を 1 つ行う。成功したら画面を読み込み直す（削除なら一覧へ戻る） */
	async function run(method: string, body?: unknown, afterDelete = false) {
		setPending(true);
		setError(null);
		const result = await callApi(path, { method, body });
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return;
		}
		if (afterDelete) {
			router.replace("/profiles");
		}
		router.refresh();
	}

	async function handleSave(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const name = String(data.get("name"));
		const bio = String(data.get("bio"));
		if (normalizeName(name) === null) {
			setError(errorMessage("INVALID_NAME"));
			return;
		}
		if (!isValidBio(bio)) {
			setError(errorMessage("INVALID_BIO"));
			return;
		}
		await run("PATCH", { name, bio });
	}

	const inUse = usages.length > 0;

	return (
		<>
			{/* key で、保存した値に入力欄を合わせ直す */}
			<form key={`${profile.name}\n${profile.bio}`} onSubmit={handleSave}>
				<p>
					<label>
						名前（1〜32 文字）
						<br />
						<input name="name" defaultValue={profile.name} required />
					</label>
				</p>
				<p>
					<label>
						自己紹介（190 文字まで）
						<br />
						<textarea name="bio" rows={3} defaultValue={profile.bio} />
					</label>
				</p>
				<button type="submit" disabled={pending}>
					保存
				</button>
			</form>

			{!profile.isDefault && (
				<p>
					<button
						type="button"
						disabled={pending}
						onClick={() => run("PATCH", { isDefault: true })}
					>
						デフォルトにする
					</button>
				</p>
			)}

			<h2>使用先</h2>
			{inUse ? (
				<ul>
					{usages.map((usage) => (
						<li key={`${usage.type}:${usage.id}`}>
							{USAGE_LABELS[usage.type]}：{usage.name}
						</li>
					))}
				</ul>
			) : (
				<p>なし</p>
			)}

			<h2>削除</h2>
			{profile.isDefault ? (
				<p>デフォルトのプロフィールは削除できません。</p>
			) : inUse ? (
				<p>使用中のプロフィールは削除できません。</p>
			) : (
				<button
					type="button"
					disabled={pending}
					onClick={() => run("DELETE", undefined, true)}
				>
					削除
				</button>
			)}

			{error && <p role="alert">{error}</p>}
		</>
	);
}
