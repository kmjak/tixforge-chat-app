# API のパス（uri）

server（Hono）の API のパスの一覧。パスごとの詳細は `uri/` に 1 パス 1 ファイルで置く。画面のパスは [routes.md](routes.md) にある。

```
/
├── health                        GET   ヘルスチェック          uri/get-health.md
└── api
    ├── me                        GET   ログイン中のアカウント  uri/get-api-me.md
    ├── profiles                  GET   プロフィールの一覧      uri/get-api-profiles.md
    │   │                         POST  プロフィールの作成      uri/post-api-profiles.md
    │   └── {profileId}           GET   プロフィールの取得      uri/get-api-profiles-{profileId}.md
    │       │                     PATCH プロフィールの編集      uri/patch-api-profiles-{profileId}.md
    │       │                     DELETE プロフィールの削除     uri/delete-api-profiles-{profileId}.md
    │       └── usages            GET   プロフィールの使用先    uri/get-api-profiles-{profileId}-usages.md
    ├── servers                   GET   サーバーの一覧          uri/get-api-servers.md
    │   │                         POST  サーバーの作成          uri/post-api-servers.md
    │   └── {serverId}            GET   サーバーの取得          uri/get-api-servers-{serverId}.md
    │       ├── channels          GET   チャンネルの一覧        uri/get-api-servers-{serverId}-channels.md
    │       │   │                 POST  チャンネルの作成        uri/post-api-servers-{serverId}-channels.md
    │       │   └── {channelId}   GET   チャンネルの取得        uri/get-api-servers-{serverId}-channels-{channelId}.md
    │       │                     PATCH チャンネル名の変更      uri/patch-api-servers-{serverId}-channels-{channelId}.md
    │       │                     DELETE チャンネルの削除       uri/delete-api-servers-{serverId}-channels-{channelId}.md
    │       ├── members           GET   メンバーの一覧          uri/get-api-servers-{serverId}-members.md
    │       │   └── me            PATCH 使うプロフィールの変更  uri/patch-api-servers-{serverId}-members-me.md
    │       └── invites           POST  招待リンクの作成        uri/post-api-servers-{serverId}-invites.md
    ├── invites
    │   └── {token}               GET   招待の確認              uri/get-api-invites-{token}.md
    │       └── join              POST  招待での参加            uri/post-api-invites-{token}-join.md
    └── auth                      （Better Auth が使う）
        ├── sign-up
        │   └── email             POST  サインアップ            uri/post-api-auth-sign-up-email.md
        ├── sign-in
        │   └── email             POST  サインイン              uri/post-api-auth-sign-in-email.md
        ├── sign-out              POST  サインアウト            uri/post-api-auth-sign-out.md
        └── get-session           GET   セッションの取得        uri/get-api-auth-get-session.md
```

- [`GET /health`](uri/get-health.md) — ヘルスチェック
- [`GET /api/me`](uri/get-api-me.md) — ログイン中のアカウント
- [`GET /api/profiles`](uri/get-api-profiles.md) — プロフィールの一覧
- [`POST /api/profiles`](uri/post-api-profiles.md) — プロフィールの作成
- [`GET /api/profiles/{profileId}`](uri/get-api-profiles-{profileId}.md) — プロフィールの取得
- [`PATCH /api/profiles/{profileId}`](uri/patch-api-profiles-{profileId}.md) — プロフィールの編集・デフォルトへの切り替え
- [`DELETE /api/profiles/{profileId}`](uri/delete-api-profiles-{profileId}.md) — プロフィールの削除
- [`GET /api/profiles/{profileId}/usages`](uri/get-api-profiles-{profileId}-usages.md) — プロフィールの使用先
- [`GET /api/servers`](uri/get-api-servers.md) — サーバーの一覧
- [`POST /api/servers`](uri/post-api-servers.md) — サーバーの作成
- [`GET /api/servers/{serverId}`](uri/get-api-servers-{serverId}.md) — サーバーの取得
- [`GET /api/servers/{serverId}/channels`](uri/get-api-servers-{serverId}-channels.md) — チャンネルの一覧
- [`POST /api/servers/{serverId}/channels`](uri/post-api-servers-{serverId}-channels.md) — チャンネルの作成
- [`GET /api/servers/{serverId}/channels/{channelId}`](uri/get-api-servers-{serverId}-channels-{channelId}.md) — チャンネルの取得
- [`PATCH /api/servers/{serverId}/channels/{channelId}`](uri/patch-api-servers-{serverId}-channels-{channelId}.md) — チャンネル名の変更
- [`DELETE /api/servers/{serverId}/channels/{channelId}`](uri/delete-api-servers-{serverId}-channels-{channelId}.md) — チャンネルの削除
- [`GET /api/servers/{serverId}/members`](uri/get-api-servers-{serverId}-members.md) — メンバーの一覧
- [`PATCH /api/servers/{serverId}/members/me`](uri/patch-api-servers-{serverId}-members-me.md) — 使うプロフィールの変更
- [`POST /api/servers/{serverId}/invites`](uri/post-api-servers-{serverId}-invites.md) — 招待リンクの作成
- [`GET /api/invites/{token}`](uri/get-api-invites-{token}.md) — 招待の確認
- [`POST /api/invites/{token}/join`](uri/post-api-invites-{token}-join.md) — 招待での参加
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

どの API にも共通で、次の 3 つはこの形で返す（個々の API の詳細のファイルには書かない）。

| ステータス | `code` | 起きるとき |
|------------|--------|-----------|
| 401 | `UNAUTHORIZED` | ログインが必要な API を、有効なセッション無しで呼んだ（下の「ログインの確認」） |
| 404 | `NOT_FOUND` | 存在しない API を呼んだ（ログインが必要なパスでは、未ログインなら 401 が先に返る） |
| 500 | `INTERNAL_SERVER_ERROR` | 処理の中で想定外のエラーが起きた。理由はサーバーのログにだけ出し、応答には含めない |

API の処理が意図して 4xx を返すとき（入力の検査で 400 にする、など）は、そのステータスのまま、この形で返す（server は Hono の `HTTPException` の 4xx をそのまま返す）。API ごとの `code` は、各 API の詳細のファイルに書く。`code` を特に決めずに返したときは、ステータスに対応する次の名前になる（一覧に無いステータスは `HTTP_<ステータス>`）。

| ステータス | `code` |
|------------|--------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `UNPROCESSABLE_ENTITY` |
| 429 | `TOO_MANY_REQUESTS` |

## ログインの確認
- `/api` の下の API は、既定でログインが必要。server は、`/api/*` へのリクエストのたびに、セッションの cookie から Better Auth のセッションを確かめる（GT-000007）。
- ログイン無しで使える API は、server のコードの一覧（`apps/server/src/app.ts` の `PUBLIC_API_PREFIXES`）に明示したものだけ。今は `/api/auth/*`（Better Auth）だけで、`/api` の外の `GET /health` ももともと対象外。新しい API は、何もしなければログインが必要になる。
- セッションが無い・無効・サインアウト済み・期限切れのときは 401（`UNAUTHORIZED`）を返す。存在しないパスでも、未ログインなら 401 を返す（API があるかどうかを知らせない）。
- この確認では、セッションの期限を延ばさない。期限の延長は、web が画面を開くたびに呼ぶ [`GET /api/auth/get-session`](uri/get-api-auth-get-session.md) が行う。
- ログイン済みなら、API の処理の中で呼び出したアカウント（id・メールアドレス）を取り出せる。

## セッションの渡し方
- ログインのセッションは、Better Auth のセッションの cookie で渡す。サインアップ・サインインの成功時に server が設定し、サインアウトで消す。
- cookie の名前は Better Auth が決める（HTTPS の環境では先頭に `__Secure-` が付くなど、環境で変わる）。web は cookie の名前でログイン状態を判定せず、[`GET /api/auth/get-session`](uri/get-api-auth-get-session.md) で判定する。
- web（:3000）と server（:3001）は origin が違うので、cookie 付きで呼ぶには CORS（credentials）と Better Auth の `trustedOrigins` の設定が要る（server の環境変数 `WEB_ORIGIN` の origin を許可している）。
- web は、server の API を cookie 付きで呼ぶ。「認証が必要」な API を有効なセッション無しで呼ぶと、401（`UNAUTHORIZED`）を返す。
