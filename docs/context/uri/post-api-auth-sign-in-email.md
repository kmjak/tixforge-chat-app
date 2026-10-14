# `POST /api/auth/sign-in/email`
## サインイン

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| メソッド | POST |
| 認証が必要か | 不要 |
| 権限 | なし |
| パスパラメータ | なし |
| リクエスト | 下の表（JSON） |
| query | なし |
| 呼び出し元 URL | [`/sign-in`](../routes/sign-in.md) |

メールアドレスとパスワードでログインする（セッションの cookie を設定する）。Better Auth が提供する。回数を制限する（429）ので、パスワードを総当たりで試されにくい。

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `email` | string | はい | メールアドレス |
| `password` | string | はい | パスワード |
| `rememberMe` | boolean | いいえ | `false` にすると、ブラウザを閉じたらログインが切れる。省略すると `true` |

```json
{ "email": "taro@example.com", "password": "Passw0rd!" }
```

### http status
#### 200 ログインした

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `redirect` | boolean | はい | 移る先があるか（このアプリでは使わないので常に `false`） |
| `token` | string | はい | セッションのトークン（web は cookie を使うので、使わない） |
| `user` | `User` | はい | ログインしたアカウント。形は [サインアップの `User`](post-api-auth-sign-up-email.md) と同じ |

```json
{
  "redirect": false,
  "token": "x1y2z3",
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

#### 400 メールアドレスの形が正しくない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_EMAIL`

```json
{ "code": "INVALID_EMAIL", "message": "Invalid email" }
```

#### 401 メールアドレスかパスワードが違う
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_EMAIL_OR_PASSWORD`（どちらが違うかは区別しない）

```json
{ "code": "INVALID_EMAIL_OR_PASSWORD", "message": "Invalid email or password" }
```

#### 429 回数の制限を超えた
短い時間に呼びすぎたとき（Better Auth の rate limit。上限は Better Auth の既定を使う）。本文は `message` だけで、`code` が無い（[エラーの共通形式](../uri.md#エラーの共通形式)の例外。web は共通のエラー表示にする）。

```json
{ "message": "Too many requests. Please try again later." }
```
