# `GET /api/invites/{token}`
## 招待の確認

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | ログインしていること（招待リンクを知っていること） |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/invites/{token}`](../routes/invites-{token}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `token` | string | 招待リンクのトークン |

### http status
#### 200 招待

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `server` | `{ id: string, name: string }` | はい | 参加する先のサーバー |
| `isMember` | boolean | はい | 既にメンバーか |
| `expiresAt` | `string \| null` | はい | 有効期限（ISO 8601）。無制限なら `null` |

```json
{ "server": { "id": "7c1e…", "name": "ゲーム仲間" }, "isMember": false, "expiresAt": null }
```

#### 404 招待リンクが存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVITE_NOT_FOUND`

#### 410 招待リンクの有効期限が切れている
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVITE_EXPIRED`
