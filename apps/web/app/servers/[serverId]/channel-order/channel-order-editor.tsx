"use client";

import {
	type CategoryResponse,
	type ChannelLayoutResponse,
	type ChannelResponse,
	MAX_CATEGORIES,
	normalizeChannelName,
} from "@chat-app/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { callApi } from "../../../../lib/api";
import {
	type ChannelLayout,
	categoryOf,
	type Direction,
	findOverLimit,
	moveCategory,
	moveChannel,
	moveChannelTo,
	sameOrder,
	toLayoutRequest,
} from "../../../../lib/channel-layout";
import { errorMessage } from "../../../../lib/error-messages";

/**
 * カテゴリの作成・名前の変更・削除と、チャンネルの並べ替え（オーナーだけに出す）。
 * 並びは画面の中だけで変え、「保存」でまとめて送る。カテゴリの操作はその場で送って読み込み直すので、
 * 保存していない並びがある間は押せないようにする（読み込み直すと消えるため）
 */
export function ChannelOrderEditor({
	serverId,
	layout: saved,
}: {
	serverId: string;
	layout: ChannelLayoutResponse;
}) {
	const router = useRouter();
	const [layout, setLayout] = useState<ChannelLayout>(saved);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const api = `/api/servers/${encodeURIComponent(serverId)}`;

	// 読み込み直したら（router.refresh）、画面の並びも server の並びに合わせ直す
	useEffect(() => {
		setLayout(saved);
	}, [saved]);

	const dirty = !sameOrder(layout, saved);
	const categoryBusy = pending || dirty;
	const categories = layout.categories.map(({ id, name }) => ({ id, name }));

	function update(next: ChannelLayout) {
		setLayout(next);
		setNotice(null);
		setError(null);
	}

	async function handleSave() {
		const over = findOverLimit(layout);
		if (over) {
			setError(
				`${over.name ?? "カテゴリに属さないチャンネル"}は ${over.limit} 個までです。`,
			);
			return;
		}
		setPending(true);
		setError(null);
		const result = await callApi<ChannelLayoutResponse>(
			`${api}/channel-layout`,
			{ method: "PUT", body: toLayoutRequest(layout) },
		);
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			if (result.code === "LAYOUT_OUTDATED") {
				router.refresh();
			}
			return;
		}
		setNotice("保存しました。");
		router.refresh();
	}

	/** カテゴリの操作を送り、成功したら読み込み直す */
	async function sendCategory(
		path: string,
		method: string,
		body?: { name: string },
	): Promise<boolean> {
		if (body && normalizeChannelName(body.name) === null) {
			setError(errorMessage("INVALID_CATEGORY_NAME"));
			return false;
		}
		setPending(true);
		setError(null);
		setNotice(null);
		const result = await callApi(path, { method, body });
		setPending(false);
		if (!result.ok) {
			setError(errorMessage(result.code));
			return false;
		}
		router.refresh();
		return true;
	}

	async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const name = String(new FormData(form).get("name"));
		if (await sendCategory(`${api}/categories`, "POST", { name })) {
			form.reset();
		}
	}

	return (
		<>
			<h2>並び順</h2>
			<p>
				↑↓
				で順を、「カテゴリ」でチャンネルの入るカテゴリを変え、最後に「保存」を押してください。
			</p>
			<h3>カテゴリなし</h3>
			<ChannelRows
				channels={layout.channels}
				categories={categories}
				layout={layout}
				onChange={update}
				disabled={pending}
			/>
			{layout.categories.map((category, index) => (
				<section key={category.id}>
					<h3>
						{category.name}{" "}
						<MoveButtons
							label={category.name}
							disabled={pending}
							isFirst={index === 0}
							isLast={index === layout.categories.length - 1}
							onMove={(direction) =>
								update(moveCategory(layout, category.id, direction))
							}
						/>
					</h3>
					<ChannelRows
						channels={category.channels}
						categories={categories}
						layout={layout}
						onChange={update}
						disabled={pending}
					/>
				</section>
			))}
			<p>
				<button type="button" onClick={handleSave} disabled={pending || !dirty}>
					保存
				</button>{" "}
				<button
					type="button"
					onClick={() => update(saved)}
					disabled={pending || !dirty}
				>
					元に戻す
				</button>
			</p>
			{notice && <p role="status">{notice}</p>}
			{error && <p role="alert">{error}</p>}

			<h2>カテゴリ</h2>
			{dirty && <p>並び順を保存するか元に戻すと、カテゴリを操作できます。</p>}
			<ul>
				{saved.categories.map((category) => (
					<CategoryRow
						key={`${category.id}:${category.name}`}
						category={category}
						hasDefault={category.channels.some((ch) => ch.isDefault)}
						channelCount={category.channels.length}
						disabled={categoryBusy}
						onRename={(name) =>
							sendCategory(`${api}/categories/${category.id}`, "PATCH", {
								name,
							})
						}
						onDelete={() =>
							sendCategory(`${api}/categories/${category.id}`, "DELETE")
						}
					/>
				))}
			</ul>
			{saved.categories.length < MAX_CATEGORIES ? (
				<form onSubmit={handleCreateCategory}>
					<label>
						新しいカテゴリ（文字・数字・-・_ で 100 文字まで）{" "}
						<input name="name" required disabled={categoryBusy} />
					</label>{" "}
					<button type="submit" disabled={categoryBusy}>
						作成
					</button>
				</form>
			) : (
				<p>カテゴリは {MAX_CATEGORIES} 個まで作れます。</p>
			)}
		</>
	);
}

function MoveButtons({
	label,
	disabled,
	isFirst,
	isLast,
	onMove,
}: {
	label: string;
	disabled: boolean;
	isFirst: boolean;
	isLast: boolean;
	onMove: (direction: Direction) => void;
}) {
	return (
		<>
			<button
				type="button"
				aria-label={`${label} を上へ`}
				disabled={disabled || isFirst}
				onClick={() => onMove(-1)}
			>
				↑
			</button>
			<button
				type="button"
				aria-label={`${label} を下へ`}
				disabled={disabled || isLast}
				onClick={() => onMove(1)}
			>
				↓
			</button>
		</>
	);
}

function ChannelRows({
	channels,
	categories,
	layout,
	onChange,
	disabled,
}: {
	channels: ChannelResponse[];
	categories: CategoryResponse[];
	layout: ChannelLayout;
	onChange: (layout: ChannelLayout) => void;
	disabled: boolean;
}) {
	if (channels.length === 0) {
		return <p>（チャンネルなし）</p>;
	}
	return (
		<ul>
			{channels.map((channel, index) => (
				<li key={channel.id}>
					# {channel.name}
					{channel.isDefault && "（既定）"}{" "}
					<MoveButtons
						label={channel.name}
						disabled={disabled}
						isFirst={index === 0}
						isLast={index === channels.length - 1}
						onMove={(direction) =>
							onChange(moveChannel(layout, channel.id, direction))
						}
					/>{" "}
					<label>
						カテゴリ{" "}
						<select
							value={categoryOf(layout, channel.id) ?? ""}
							disabled={disabled}
							onChange={(event) =>
								onChange(
									moveChannelTo(layout, channel.id, event.target.value || null),
								)
							}
						>
							<option value="">カテゴリなし</option>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
					</label>
				</li>
			))}
		</ul>
	);
}

function CategoryRow({
	category,
	hasDefault,
	channelCount,
	disabled,
	onRename,
	onDelete,
}: {
	category: CategoryResponse;
	hasDefault: boolean;
	channelCount: number;
	disabled: boolean;
	onRename: (name: string) => Promise<boolean>;
	onDelete: () => Promise<boolean>;
}) {
	function handleRename(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void onRename(String(new FormData(event.currentTarget).get("name")));
	}

	function handleDelete() {
		// 中のチャンネルも一緒に消え、取り戻せないので、必ず確かめる。画面の数は古いことがある
		// （別のタブでチャンネルを足した後など）ので、数によらず確認を出す
		const inside =
			channelCount > 0
				? `中のチャンネル（この画面では ${channelCount} 個）もすべて削除されます。`
				: "中のチャンネルもすべて削除されます。";
		if (
			!window.confirm(
				`カテゴリ「${category.name}」を削除します。${inside}よろしいですか？`,
			)
		) {
			return;
		}
		void onDelete();
	}

	return (
		<li>
			<form onSubmit={handleRename}>
				<label>
					カテゴリ名{" "}
					<input
						name="name"
						defaultValue={category.name}
						required
						disabled={disabled}
					/>
				</label>{" "}
				<button type="submit" disabled={disabled}>
					名前を変える
				</button>{" "}
				{hasDefault ? (
					<span>既定のチャンネルが入っているので、削除できません。</span>
				) : (
					<button type="button" disabled={disabled} onClick={handleDelete}>
						削除（中のチャンネルも削除）
					</button>
				)}
			</form>
		</li>
	);
}
