# `GET /api/servers/{serverId}/channels/{channelId}`
## チャンネルの取得

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのメンバーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}/channels/{channelId}`](../routes/servers-{serverId}-channels-{channelId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

### http status
#### 200 チャンネル

`Channel`（[`GET /api/servers/{serverId}/channels`](get-api-servers-{serverId}-channels.md) と同じ形）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやチャンネルが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したチャンネルも 404。
