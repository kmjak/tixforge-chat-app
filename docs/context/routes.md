# 画面のパス（routes）

web（Next.js）の画面のパスの一覧。パスごとの詳細は `routes/` に 1 パス 1 ファイルで置く。API のパスは [uri.md](uri.md) にある。

```
/                 トップ（LP）            routes/root.md
├── sign-in       サインイン              routes/sign-in.md
├── sign-up       サインアップ            routes/sign-up.md
├── home          ログイン後の画面        routes/home.md
└── profiles      プロフィールの一覧      routes/profiles.md
    └── {profileId}  プロフィールの詳細   routes/profiles-{profileId}.md
```

- [`/`](routes/root.md) — トップ（LP）
- [`/sign-in`](routes/sign-in.md) — サインイン
- [`/sign-up`](routes/sign-up.md) — サインアップ
- [`/home`](routes/home.md) — ログイン後の画面
- [`/profiles`](routes/profiles.md) — プロフィールの一覧
- [`/profiles/{profileId}`](routes/profiles-{profileId}.md) — プロフィールの詳細

## 命名と階層のルール
- パスは英小文字の kebab-case にする（例：`/sign-in`）。
- パスパラメータは `{camelCase}` と書く（例：`/servers/{serverId}`）。Next.js の `[serverId]` などの書き方には合わせない。
- `/api` で始まるパスは API に使うので、画面には使わない。
- ログイン後の画面は、機能ごとに最上位に置く（例：`/home`・`/friends`・`/servers/{serverId}/channels/{channelId}`）。中のものは、親のパスの下に置く。
- 公開する画面は `/`・`/sign-in`・`/sign-up` だけで、それ以外の画面はすべてログインが必要にする。新しい画面は、特に決めない限りログインが必要になる。

## ファイル名の規則
詳細のファイル名は、パスから機械的に決める（パスからファイルを探せるようにするため）。

- 先頭の `/` を除き、残りの `/` を `-` に置き換えて `.md` を付ける。
- パスパラメータは `{serverId}` のまま残す。
- `/` だけは `root.md` にする。

| パス | ファイル |
|------|----------|
| `/` | `routes/root.md` |
| `/sign-in` | `routes/sign-in.md` |
| `/servers/{serverId}/channels/{channelId}` | `routes/servers-{serverId}-channels-{channelId}.md` |

## 追記の決まり
**新しいパスを作るチケットは、このファイル（Tree と一覧）と `routes/` の詳細のファイルを追加・更新する。** パスを実装・廃止したチケットは、詳細のファイルの「状態」を更新する。

詳細のファイルは次の形で書く。別のパスを指すときは、その詳細のファイルへの相対リンクにする。

```markdown
# `<パス>`
## <画面の内容>

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000000） |
| 認証が必要か | 必要・不要 |
| 未ログイン時の動き | … |
| ログイン済み時の動き | … |
| 権限 | … |
| パスパラメータ | なし、または表 |
| query | なし、または表 |
| 遷移可能先 | [`/home`](home.md) |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md) |

### 詳細
- …
```

## 状態の書き方
- `予定（<チケット id>）`：そのチケットで作る
- `実装済み（<チケット id>）`：そのチケットで作った
- `廃止予定（<チケット id>）`：そのチケットで消す

## 保護する画面の共通の動き
- ログインが必要な画面を未ログインで開いたら、`/sign-in?redirect=<開こうとしたパス>` へリダイレクトする。開こうとしたパスは、query も含めて URL エンコードして渡す（例：`/servers/a?tab=b` → `redirect=%2Fservers%2Fa%3Ftab%3Db`）。
- `redirect` の query は、次をすべて満たすときだけ受け付ける。受け付けないとき・無いときは `/home` に移る。外部のサイトへ移されないようにするため（`/\evil.com` などは、ブラウザが `//evil.com` と解釈する）。
  - `/` で始まり、`//` で始まらない
  - `\`・制御文字（タブ・改行など）・空白を含まない
  - アプリの origin を基準に URL として解決した（`new URL(redirect, origin)`）結果の origin が、アプリの origin と同じ
- `/sign-in` と `/sign-up` の間のリンクは、受け取った `redirect` を引き継ぐ（サインインの画面からサインアップへ進んでも、元の行き先へ戻れるようにするため）。
- ログイン済みで `/` を開いたら、`/home` へリダイレクトする。ログイン済みで `/sign-in`・`/sign-up` を開いたら、`redirect` の先（受け付けないとき・無いときは `/home`）へリダイレクトする（サインインに成功したときと同じ規則）。
- ログイン状態は [`GET /api/auth/get-session`](uri/get-api-auth-get-session.md) で判定する。
