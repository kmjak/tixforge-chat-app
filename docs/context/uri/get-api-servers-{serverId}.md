# `GET /api/servers/{serverId}`
## サーバーの取得

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのメンバーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}`](../routes/servers-{serverId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID）。自分がメンバーでない・存在しない・UUID の形でないときは 404 |

### http status
#### 200 サーバー

`Server`（[`GET /api/servers`](get-api-servers.md) と同じ形）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。
