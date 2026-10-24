/** `GET /health` のレスポンス。DB に接続できれば 200 で ok、できなければ 503 で error */
export type HealthResponse =
	| { status: "ok"; db: "ok" }
	| { status: "error"; db: "error" };

/** `GET /api/me` のレスポンス。ログインしているアカウント（本人）の情報 */
export type MeResponse = {
	id: string;
	email: string;
	defaultProfile: { id: string; name: string; bio: string };
};

/** 本人に見せるプロフィール（`/api/profiles` の API） */
export type ProfileResponse = {
	id: string;
	name: string;
	bio: string;
	isDefault: boolean;
};

/** `GET /api/profiles` のレスポンス。デフォルトが先頭、残りは作った順 */
export type ProfilesResponse = { profiles: ProfileResponse[] };

/** プロフィールの使用先 1 つ。id・name は割り当て先（サーバーなど）のもの */
export type ProfileUsageResponse = {
	type: "server" | "friend" | "groupDm";
	id: string;
	name: string;
};

/** `GET /api/profiles/{profileId}/usages` のレスポンス */
export type ProfileUsagesResponse = { usages: ProfileUsageResponse[] };

/** 自分が参加しているサーバー（`/api/servers` の API） */
export type ServerResponse = {
	id: string;
	name: string;
	isOwner: boolean;
	/** そのサーバーで自分が使うプロフィール */
	myProfile: { id: string; name: string };
};

/** `GET /api/servers` のレスポンス。参加した順 */
export type ServersResponse = { servers: ServerResponse[] };

/** メンバーの一覧の 1 行。アカウントの id は含めない */
export type ServerMemberResponse = {
	profile: { id: string; name: string; bio: string };
	isOwner: boolean;
	isMe: boolean;
};

/** `GET /api/servers/{serverId}/members` のレスポンス */
export type ServerMembersResponse = { members: ServerMemberResponse[] };

/** `POST /api/servers/{serverId}/invites` のレスポンス。expiresAt は ISO 8601（無制限なら null） */
export type CreatedInviteResponse = { token: string; expiresAt: string | null };

/** `GET /api/invites/{token}` のレスポンス */
export type InviteResponse = {
	server: { id: string; name: string };
	isMember: boolean;
	expiresAt: string | null;
};

/** `POST /api/invites/{token}/join` のレスポンス */
export type JoinServerResponse = { serverId: string; alreadyMember: boolean };

/** サーバーのチャンネル（`/api/servers/{serverId}/channels` の API） */
export type ChannelResponse = { id: string; name: string; isDefault: boolean };

/** `GET /api/servers/{serverId}/channels` のレスポンス。作った順 */
export type ChannelsResponse = { channels: ChannelResponse[] };

/** チャンネルのカテゴリ（`/api/servers/{serverId}/categories` の API） */
export type CategoryResponse = { id: string; name: string };

/**
 * サーバーのチャンネルの並び（`GET /api/servers/{serverId}/channels`・
 * `PUT /api/servers/{serverId}/channel-layout` のレスポンス）。
 * `channels` はカテゴリに属さないチャンネル。どれも並び順のとおり
 */
export type ChannelLayoutResponse = {
	channels: ChannelResponse[];
	categories: (CategoryResponse & { channels: ChannelResponse[] })[];
};

/** `PUT /api/servers/{serverId}/channel-layout` のリクエスト。今のカテゴリ・チャンネルをすべて並べる */
export type ChannelLayoutRequest = {
	channels: string[];
	categories: { id: string; channels: string[] }[];
};

/** 4xx・5xx のレスポンスの共通形式（docs/context/uri.md「エラーの共通形式」） */
export type ErrorResponse = {
	/** エラーの種類（英大文字の SNAKE_CASE）。web はこれで分岐する */
	code: string;
	/** 人が読むための説明 */
	message: string;
};
export {
	BIO_MAX_LENGTH,
	CHANNEL_NAME_MAX_LENGTH,
	INVITE_EXPIRY_HOURS,
	type InviteExpiryHours,
	isInviteExpiryHours,
	isPasswordLengthValid,
	isStrongPassword,
	isValidBio,
	MAX_CATEGORIES,
	MAX_CHANNELS_PER_CATEGORY,
	MAX_CHANNELS_WITHOUT_CATEGORY,
	MAX_PROFILES,
	NAME_MAX_LENGTH,
	normalizeChannelName,
	normalizeName,
	normalizeServerName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	SERVER_NAME_MAX_LENGTH,
} from "./validation";
