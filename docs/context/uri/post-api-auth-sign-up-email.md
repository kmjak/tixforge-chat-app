# `POST /api/auth/sign-up/email`
## サインアップ

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| メソッド | POST |
| 認証が必要か | 不要 |
| 権限 | なし |
| パスパラメータ | なし |
| リクエスト | 下の表（JSON） |
| query | なし |
| 呼び出し元 URL | [`/sign-up`](../routes/sign-up.md) |

メールアドレスとパスワードでアカウントを作り、そのままログインした状態にする（セッションの cookie を設定する）。Better Auth が提供する。

- 登録済みのメールアドレスには 422 を返すので、第三者がそのメールアドレスが登録済みかを知れる。MVP ではこれを許容し、回数の制限（429）で大量に調べられないようにする。完全に防ぐにはメールアドレスの確認が要る（MVP の対象外）ので、MVP の後に見直す。

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `name` | string | はい | 名前（前後の空白を除いて 1〜32 文字。除いた値で登録する。デフォルトのプロフィールの名前になる） |
| `email` | string | はい | メールアドレス |
| `password` | string | はい | パスワード（8〜128 文字。記号・英小文字・英大文字をそれぞれ 1 文字以上含む） |

```json
{ "name": "Taro", "email": "taro@example.com", "password": "Passw0rd!" }
```

### http status
#### 200 アカウントを作り、ログインした

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `token` | `string \| null` | はい | セッションのトークン（web は cookie を使うので、使わない） |
| `user` | `User` | はい | 作ったアカウント（下の表） |

`User`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | string | はい | アカウントの id（ほかのアカウントに見せない） |
| `name` | string | はい | 名前 |
| `email` | string | はい | メールアドレス |
| `emailVerified` | boolean | はい | メールアドレスを確認済みか（MVP では確認しないので常に `false`） |
| `image` | `string \| null` | はい | 画像（MVP では使わないので `null`） |
| `createdAt` | string | はい | 作った日時（ISO 8601） |
| `updatedAt` | string | はい | 更新した日時（ISO 8601） |

```json
{
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

#### 400 入力が正しくない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：

| code | 起きるとき |
|------|-----------|
| `INVALID_EMAIL` | メールアドレスの形が正しくない |
| `INVALID_NAME` | 名前が、前後の空白を除いて 1〜32 文字でない（このアプリで足す。GT-000003） |
| `PASSWORD_TOO_SHORT` | パスワードが 8 文字より短い |
| `PASSWORD_TOO_LONG` | パスワードが 128 文字より長い |
| `PASSWORD_TOO_WEAK` | パスワードに記号・英小文字・英大文字のどれかが無い（このアプリで足す。GT-000003） |

```json
{ "code": "PASSWORD_TOO_WEAK", "message": "Password must contain a symbol, a lowercase letter and an uppercase letter" }
```

#### 422 メールアドレスが登録済み
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`

```json
{ "code": "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "message": "User already exists. Use another email." }
```

#### 429 回数の制限を超えた
短い時間に呼びすぎたとき（Better Auth の rate limit。上限は Better Auth の既定を使う）。本文は `message` だけで、`code` が無い（[エラーの共通形式](../uri.md#エラーの共通形式)の例外。web は共通のエラー表示にする）。

```json
{ "message": "Too many requests. Please try again later." }
```
