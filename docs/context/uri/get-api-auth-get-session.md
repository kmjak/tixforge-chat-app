# `GET /api/auth/get-session`
## セッションの取得

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| メソッド | GET |
| 認証が必要か | 不要（未ログインなら `null` を返す） |
| 権限 | なし |
| パスパラメータ | なし |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/`](../routes/root.md)・[`/sign-in`](../routes/sign-in.md)・[`/sign-up`](../routes/sign-up.md)・[`/home`](../routes/home.md) |

ログインしているかと、ログインしているアカウントを返す。web はこれでログイン状態を判定する。Better Auth が提供する。

### http status
#### 200 ログインしている

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `session` | `Session` | はい | 今のセッション（下の表） |
| `user` | `User` | はい | ログインしているアカウント。形は [サインアップの `User`](post-api-auth-sign-up-email.md) と同じ |

`Session`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | string | はい | セッションの id |
| `userId` | string | はい | アカウントの id |
| `token` | string | はい | セッションのトークン |
| `expiresAt` | string | はい | 期限（ISO 8601） |
| `ipAddress` | `string \| null` | はい | ログインしたときの IP アドレス |
| `userAgent` | `string \| null` | はい | ログインしたときのブラウザ |
| `createdAt` | string | はい | 作った日時（ISO 8601） |
| `updatedAt` | string | はい | 更新した日時（ISO 8601） |

```json
{
  "session": {
    "id": "s_123",
    "userId": "u_123",
    "token": "x1y2z3",
    "expiresAt": "2026-10-22T00:00:00.000Z",
    "ipAddress": "127.0.0.1",
    "userAgent": "Mozilla/5.0",
    "createdAt": "2026-10-15T00:00:00.000Z",
    "updatedAt": "2026-10-15T00:00:00.000Z"
  },
  "user": {
    "id": "u_123",
    "name": "Taro",
    "email": "taro@example.com",
    "emailVerified": false,
    "image": null,
    "createdAt": "2026-10-15T00:00:00.000Z",
    "updatedAt": "2026-10-15T00:00:00.000Z"
  }
}
```

#### 200 ログインしていない
本文は `null`（エラーにはしない）。

```json
null
```
