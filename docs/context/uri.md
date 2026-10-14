# API のパス（uri）

server（Hono）の API のパスの一覧。パスごとの詳細は `uri/` に 1 パス 1 ファイルで置く。画面のパスは [routes.md](routes.md) にある。

```
/
├── health                        GET   ヘルスチェック          uri/get-health.md
└── api
    └── auth                      （Better Auth が使う）
        ├── sign-up
        │   └── email             POST  サインアップ            uri/post-api-auth-sign-up-email.md
        ├── sign-in
        │   └── email             POST  サインイン              uri/post-api-auth-sign-in-email.md
        ├── sign-out              POST  サインアウト            uri/post-api-auth-sign-out.md
        └── get-session           GET   セッションの取得        uri/get-api-auth-get-session.md
```

- [`GET /health`](uri/get-health.md) — ヘルスチェック
- [`POST /api/auth/sign-up/email`](uri/post-api-auth-sign-up-email.md) — サインアップ
- [`POST /api/auth/sign-in/email`](uri/post-api-auth-sign-in-email.md) — サインイン
- [`POST /api/auth/sign-out`](uri/post-api-auth-sign-out.md) — サインアウト
- [`GET /api/auth/get-session`](uri/get-api-auth-get-session.md) — セッションの取得

## 命名と階層のルール
- パスは英小文字の kebab-case にする。パスパラメータは `{camelCase}` と書く（例：`/api/servers/{serverId}`）。Hono の `:serverId` の書き方には合わせない。
- アプリの API はすべて `/api` の下に置く。
- リソースは複数形の名詞にし、中のものは親の下に置く（例：`/api/servers/{serverId}/channels`）。何をするかはメソッドで表す（取得 `GET`・作成 `POST`・更新 `PATCH`・削除 `DELETE`）。
- `/api/auth/*` は Better Auth が使うので、ほかの API に使わない。Better Auth のパスはライブラリが決めるので、上の命名に合わないものもある（`/api/auth/get-session` など）。
- 例外：`GET /health` は監視用で、`/api` の外に置く（ログイン不要）。
- 特に決めない限り、API はログインが必要にする。

## ファイル名の規則
詳細のファイル名は、メソッドとパスから機械的に決める（パスからファイルを探せるようにするため）。

- `<小文字のメソッド>-<パス>.md`。パスは先頭の `/` を除き、残りの `/` を `-` に置き換える。
- パスパラメータは `{serverId}` のまま残す。

| メソッドとパス | ファイル |
|----------------|----------|
| `GET /health` | `uri/get-health.md` |
| `POST /api/auth/sign-up/email` | `uri/post-api-auth-sign-up-email.md` |
| `GET /api/servers/{serverId}/channels` | `uri/get-api-servers-{serverId}-channels.md` |

## 追記の決まり
**新しいパスを作るチケットは、このファイル（Tree と一覧）と `uri/` の詳細のファイルを追加・更新する。** パスを実装・廃止したチケットは、詳細のファイルの「状態」を更新する。

詳細のファイルは次の形で書く。別のパスを指すときは、その詳細のファイルへの相対リンクにする。

```markdown
# `<メソッド> <パス>`
## <API の内容>

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000000） |
| メソッド | GET |
| 認証が必要か | 必要・不要 |
| 権限 | … |
| パスパラメータ | なし、または表 |
| リクエスト | なし、または表 |
| query | なし、または表 |
| ページネーション | 一覧を返す API だけ書く |
| 呼び出し元 URL | [`/home`](../routes/home.md) |

### http status
#### 200 <定義>
（型の表とレスポンスの例）
```

- 型は表（フィールド・型・必須・説明）で書き、言語に依存しない型名（`string`・`number`・`boolean`・`null`・`User[]` など）を使う。null になりうるものは `string | null` と書く。
- 4xx・5xx は、下の「エラーの共通形式」で返す。`code` の値をステータスごとに書く。

## 状態の書き方
- `予定（<チケット id>）`：そのチケットで作る
- `実装済み（<チケット id>）`：そのチケットで作った
- `廃止予定（<チケット id>）`：そのチケットで消す

## エラーの共通形式
4xx・5xx のレスポンスは、すべての API で次の形にする（例外は各 API に明記する）。Better Auth（`/api/auth/*`）のエラーも基本は同じ形で返るが、`code` が無いもの（回数の制限を超えたときの 429 など）がある。web は、`code` が無いとき・知らない値のときは、共通のエラー表示にする。

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `code` | string | はい | エラーの種類。英大文字の SNAKE_CASE（例：`UNAUTHORIZED`）。web はこれで分岐する |
| `message` | string | はい | 人が読むための説明。画面にそのまま出すことは前提にしない |

```json
{ "code": "UNAUTHORIZED", "message": "Unauthorized" }
```

## セッションの渡し方
- ログインのセッションは、Better Auth のセッションの cookie で渡す。サインアップ・サインインの成功時に server が設定し、サインアウトで消す。
- cookie の名前は Better Auth が決める（HTTPS の環境では先頭に `__Secure-` が付くなど、環境で変わる）。web は cookie の名前でログイン状態を判定せず、[`GET /api/auth/get-session`](uri/get-api-auth-get-session.md) で判定する。
- web（:3000）と server（:3001）は origin が違うので、cookie 付きで呼ぶには CORS（credentials）と Better Auth の `trustedOrigins` の設定が要る（GT-000003 で設定する）。
- web は、server の API を cookie 付きで呼ぶ。「認証が必要」な API を有効なセッション無しで呼ぶと、401（`UNAUTHORIZED`）を返す。
