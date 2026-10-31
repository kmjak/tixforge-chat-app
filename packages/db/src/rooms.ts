import type { WsRoom } from "@chat-app/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "./client";
import { isUuid } from "./ownership";
import { channels, serverMembers } from "./schema";

/**
 * 部屋（WebSocket のイベントの届け先）の、今の参加者のアカウントの id の一覧。
 * チャンネルなら、削除されていないチャンネルのサーバーの、今のメンバー（退出していない）。
 * 送るたびに引くので、参加・退出・チャンネルの作成・削除がすぐに反映される（docs/context/ws.md）
 */
export async function listRoomMemberIds(
	db: AnyDb,
	room: WsRoom,
): Promise<string[]> {
	if (!isUuid(room.id)) {
		return [];
	}
	const rows = await db
		.select({ userId: serverMembers.userId })
		.from(channels)
		.innerJoin(serverMembers, eq(serverMembers.serverId, channels.serverId))
		.where(
			and(
				eq(channels.id, room.id),
				isNull(channels.deletedAt),
				isNull(serverMembers.leftAt),
			),
		);
	return rows.map((row) => row.userId);
}
