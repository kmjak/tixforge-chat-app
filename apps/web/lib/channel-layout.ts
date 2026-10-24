import {
	type ChannelLayoutRequest,
	type ChannelLayoutResponse,
	type ChannelResponse,
	MAX_CHANNELS_PER_CATEGORY,
	MAX_CHANNELS_WITHOUT_CATEGORY,
} from "@chat-app/shared";

/**
 * 並べ替えの画面で扱う並び。server の一覧と同じ形（channels はカテゴリに属さないチャンネル）。
 * どの関数も元の並びを変えずに、新しい並びを返す
 */
export type ChannelLayout = ChannelLayoutResponse;

/** 上へ（-1）か、下へ（1） */
export type Direction = -1 | 1;

/** 配列の index の要素を、direction の向きに 1 つずらす。端なら同じ配列を返す */
function shift<T>(items: T[], index: number, direction: Direction): T[] {
	const to = index + direction;
	if (index < 0 || to < 0 || to >= items.length) {
		return items;
	}
	const next = [...items];
	const [item] = next.splice(index, 1);
	if (item !== undefined) {
		next.splice(to, 0, item);
	}
	return next;
}

/** カテゴリを 1 つ上・下へ動かす */
export function moveCategory(
	layout: ChannelLayout,
	categoryId: string,
	direction: Direction,
): ChannelLayout {
	const index = layout.categories.findIndex((k) => k.id === categoryId);
	return { ...layout, categories: shift(layout.categories, index, direction) };
}

/** チャンネルを、今の並び（カテゴリの中、またはカテゴリに属さないもの）の中で 1 つ上・下へ動かす */
export function moveChannel(
	layout: ChannelLayout,
	channelId: string,
	direction: Direction,
): ChannelLayout {
	const index = layout.channels.findIndex((ch) => ch.id === channelId);
	if (index >= 0) {
		return { ...layout, channels: shift(layout.channels, index, direction) };
	}
	return {
		...layout,
		categories: layout.categories.map((category) => {
			const i = category.channels.findIndex((ch) => ch.id === channelId);
			return i < 0
				? category
				: { ...category, channels: shift(category.channels, i, direction) };
		}),
	};
}

/** チャンネルの今のカテゴリの id。カテゴリに属さなければ null、無ければ undefined */
export function categoryOf(
	layout: ChannelLayout,
	channelId: string,
): string | null | undefined {
	if (layout.channels.some((ch) => ch.id === channelId)) {
		return null;
	}
	return layout.categories.find((k) =>
		k.channels.some((ch) => ch.id === channelId),
	)?.id;
}

/**
 * チャンネルを、別のカテゴリ（null ならカテゴリに属さない並び）の末尾へ移す。
 * 今と同じ並びを選んだときは何も変えない
 */
export function moveChannelTo(
	layout: ChannelLayout,
	channelId: string,
	categoryId: string | null,
): ChannelLayout {
	const from = categoryOf(layout, channelId);
	if (from === undefined || from === categoryId) {
		return layout;
	}
	const channel = [
		...layout.channels,
		...layout.categories.flatMap((k) => k.channels),
	].find((ch) => ch.id === channelId) as ChannelResponse;
	const without = (channels: ChannelResponse[]) =>
		channels.filter((ch) => ch.id !== channelId);
	return {
		channels:
			categoryId === null
				? [...layout.channels, channel]
				: without(layout.channels),
		categories: layout.categories.map((category) => ({
			...category,
			channels:
				category.id === categoryId
					? [...category.channels, channel]
					: without(category.channels),
		})),
	};
}

/** 上限を超えた並び。カテゴリに属さない並びなら name は null。超えた並びが無ければ null */
export function findOverLimit(
	layout: ChannelLayout,
): { name: string | null; limit: number } | null {
	if (layout.channels.length > MAX_CHANNELS_WITHOUT_CATEGORY) {
		return { name: null, limit: MAX_CHANNELS_WITHOUT_CATEGORY };
	}
	const category = layout.categories.find(
		(k) => k.channels.length > MAX_CHANNELS_PER_CATEGORY,
	);
	return category
		? { name: category.name, limit: MAX_CHANNELS_PER_CATEGORY }
		: null;
}

/** 並び順の保存（PUT /api/servers/{serverId}/channel-layout）に送る形にする */
export function toLayoutRequest(layout: ChannelLayout): ChannelLayoutRequest {
	return {
		channels: layout.channels.map((ch) => ch.id),
		categories: layout.categories.map((category) => ({
			id: category.id,
			channels: category.channels.map((ch) => ch.id),
		})),
	};
}

/** 2 つの並びの順が同じなら true（保存していない変更があるかの判定に使う） */
export function sameOrder(a: ChannelLayout, b: ChannelLayout): boolean {
	return (
		JSON.stringify(toLayoutRequest(a)) === JSON.stringify(toLayoutRequest(b))
	);
}
