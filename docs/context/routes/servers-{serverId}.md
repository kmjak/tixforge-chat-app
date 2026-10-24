# `/servers/{serverId}`
## サーバー

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=<開こうとしたパスを URL エンコード>`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する。メンバーでない・存在しないサーバーは、Next.js の 404 の画面を表示する |
| 権限 | そのサーバーのメンバーであること |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/servers`](servers.md)・[`/servers/{serverId}/channels/{channelId}`](servers-{serverId}-channels-{channelId}.md)・[`/servers/{serverId}/channel-order`](servers-{serverId}-channel-order.md) |
| 呼び出す API | [`GET /api/servers/{serverId}`](../uri/get-api-servers-{serverId}.md)・[`GET /api/servers/{serverId}/members`](../uri/get-api-servers-{serverId}-members.md)・[`PATCH /api/servers/{serverId}/members/me`](../uri/patch-api-servers-{serverId}-members-me.md)・[`POST /api/servers/{serverId}/invites`](../uri/post-api-servers-{serverId}-invites.md)・[`GET /api/servers/{serverId}/channels`](../uri/get-api-servers-{serverId}-channels.md)・[`POST /api/servers/{serverId}/channels`](../uri/post-api-servers-{serverId}-channels.md)・[`GET /api/profiles`](../uri/get-api-profiles.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |

### 詳細
- サーバーの名前と、このサーバーで自分が使うプロフィール（変更できる）を表示する。
- メンバーの一覧を表示する。各メンバーは、そのサーバーで選んだプロフィール（名前・自己紹介）で表示し、オーナー・自分には印を付ける（フレンドのメンバーをフレンドの割り当てで表示する「フレンドが優先」は GT-000015 で足す）。
- 招待リンクの作成（有効期限を 1・6・12・24・48 時間・無制限から選ぶ）。作ったら、招待の画面の URL（[`/invites/{token}`](invites-{token}.md)）と有効期限を表示する。
- チャンネルの一覧を表示する。カテゴリに属さないチャンネルを先に、続けてカテゴリの見出しと中のチャンネルを、並び順のとおりに出す（中が空のカテゴリも見出しは出す。既定のチャンネルには印）。各チャンネルから [`/servers/{serverId}/channels/{channelId}`](servers-{serverId}-channels-{channelId}.md) へ移る（GT-000011・GT-000012）。
- オーナーなら、チャンネルの作成フォーム（入れるカテゴリを選べる。既定は「カテゴリなし」）を置き、作ったらそのチャンネルの画面へ移る。カテゴリと並び順の画面（[`/servers/{serverId}/channel-order`](servers-{serverId}-channel-order.md)）へのリンクも出す（GT-000012）。
