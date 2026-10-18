import type { ProfileResponse } from "@chat-app/shared";

/**
 * 使うプロフィールの選択（ラベル付き）。初期値は selectedId（無ければデフォルトのプロフィール）。
 * フォームの値の名前は "profileId"
 */
export function ProfileSelect({
	profiles,
	selectedId,
	label,
}: {
	profiles: ProfileResponse[];
	selectedId?: string;
	label: string;
}) {
	const initial =
		selectedId ?? profiles.find((profile) => profile.isDefault)?.id ?? "";
	return (
		<label>
			{label}
			<br />
			<select name="profileId" defaultValue={initial} required>
				{profiles.map((profile) => (
					<option key={profile.id} value={profile.id}>
						{profile.name}
						{profile.isDefault && "（デフォルト）"}
					</option>
				))}
			</select>
		</label>
	);
}
