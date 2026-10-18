# `/servers/{serverId}/channels/{channelId}`
## チャンネル

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=<開こうとしたパスを URL エンコード>`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する。メンバーでない・存在しない・削除したチャンネルは、Next.js の 404 の画面を表示する |
| 権限 | そのサーバーのメンバーであること。名前の変更・削除はオーナーだけ |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/servers/{serverId}`](servers-{serverId}.md) |
| 呼び出す API | [`GET /api/servers/{serverId}`](../uri/get-api-servers-{serverId}.md)・[`GET /api/servers/{serverId}/channels/{channelId}`](../uri/get-api-servers-{serverId}-channels-{channelId}.md)・[`PATCH /api/servers/{serverId}/channels/{channelId}`](../uri/patch-api-servers-{serverId}-channels-{channelId}.md)・[`DELETE /api/servers/{serverId}/channels/{channelId}`](../uri/delete-api-servers-{serverId}-channels-{channelId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

### 詳細
- チャンネルの名前と、サーバーの画面へ戻るリンクを表示する。
- オーナーなら、名前の変更と削除ができる。削除したらサーバーの画面へ戻る。既定のチャンネルは、削除の代わりに削除できない理由を表示する。オーナーでないメンバーには、変更・削除を出さない。
- メッセージ（一覧と送信）は GT-000014 でこの画面に足す。
