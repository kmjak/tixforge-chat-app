# chat-app

1 つのアカウントで複数のプロフィールを使い分けられる、リアルタイムチャットアプリ。サービスの概要は [docs/context/overview.md](docs/context/overview.md) を参照。

## 構成

pnpm workspaces の monorepo。

| パッケージ | 内容 |
|---|---|
| `apps/web` | Next.js（画面）。ポート 3000 |
| `apps/server` | Hono（API）。ポート 3001（環境変数 `PORT` で変更可） |
| `packages/shared` | web と server で共有する型・バリデーション |
| `packages/db` | DB（Neon の Postgres）の Drizzle のクライアント・スキーマ・マイグレーション |

## セットアップ

Node.js のバージョンは `.nvmrc`（24）で、pnpm のバージョンは `package.json` の `packageManager` で固定している。

```sh
nvm install   # .nvmrc の Node.js を入れる
nvm use
corepack enable   # package.json で指定した pnpm を使う
pnpm install
cp .env.example .env   # DATABASE_URL と BETTER_AUTH_SECRET を入れる（下記「環境変数」「DB」）
pnpm db:migrate
```

## 開発

```sh
pnpm dev
```

web（http://localhost:3000）と server（http://localhost:3001）が同時に起動する。http://localhost:3000 からサインアップ・サインインできる。

## 環境変数

server はルートの `.env` を読む（`.env.example` をコピーして作る）。web はルートの `.env` を読まないので、既定値と違う値にするときは `apps/web/.env.local` に書くか、起動時に指定する。

| 変数 | 使う側 | 内容 |
|---|---|---|
| `DATABASE_URL` | server | Neon の接続文字列（下記「DB」）。必須 |
| `BETTER_AUTH_SECRET` | server | Better Auth がセッションの署名などに使う秘密の値。32 文字以上のランダムな文字列（`openssl rand -base64 32` などで作る）。必須 |
| `BETTER_AUTH_URL` | server | server の URL（既定 `http://localhost:3001`） |
| `WEB_ORIGIN` | server | web の origin（既定 `http://localhost:3000`）。この origin からの cookie 付きの呼び出し（CORS）を受け付ける |
| `PORT` | server | server のポート（既定 3001） |
| `SERVER_URL` | web | web の server 側（ページの保護）から呼ぶ server の URL（既定 `http://localhost:3001`） |
| `NEXT_PUBLIC_SERVER_URL` | web | ブラウザから呼ぶ server の URL（既定 `http://localhost:3001`）。ビルド時に埋め込まれる |

`DATABASE_URL` か `BETTER_AUTH_SECRET` が無いと、server は起動時にエラーで止まる。

## コマンド

すべてリポジトリのルートで実行する。

| コマンド | 内容 |
|---|---|
| `pnpm dev` | web と server を同時に開発起動する |
| `pnpm typecheck` | 全パッケージの型チェック |
| `pnpm lint` | Biome で lint とフォーマットを検査する（ファイルは書き換えない） |
| `pnpm format` | Biome で lint の自動修正とフォーマットを行う |
| `pnpm test` | 全パッケージのテスト（Jest） |
| `pnpm build` | web と server をビルドする |
| `pnpm db:generate` | `packages/db/src/schema.ts` の変更から、マイグレーションのファイルを作る |
| `pnpm db:migrate` | まだ適用していないマイグレーションを DB に適用する |

## DB

DB は Neon（Postgres）を使い、Drizzle ORM で扱う。DB に接続するのは server だけ。

### 接続の設定

1. Neon のプロジェクト `tixforge-chat-app` の画面で **Connect** を開く
2. 「Connection pooling」を**オフ**にする（ホスト名に `-pooler` が付かない、直接の接続になる）
3. 表示の形式（Next.js・Node.js など）は何を選んでもよい。Drizzle の選択肢は無いが、中身の接続文字列は同じ。表示された中から、`postgresql://` で始まる URL の部分だけをコピーする。ほかの変数（プーラー経由のものなど）が並んで表示されても、`.env` には入れない
4. ルートの `.env.example` を `.env` にコピーし、`DATABASE_URL=` の後ろに貼る
5. 貼った URL の `sslmode=require` を `sslmode=verify-full` に書き換える（`pg` が `require` について警告を出すため。`verify-full` はサーバーの証明書まで確かめる、今と同じ安全さの指定）

プーラーを通さないのは、server が自分で接続を使い回す（プールする）のでプーラーが要らず、マイグレーションもプーラーを通さない接続のほうが安全なため。

`.env` は git で管理しない（`.gitignore` 済み）。接続文字列にはパスワードが含まれるので、commit したり人に見せたりしない。

### マイグレーション

- テーブルを変えるときは、`packages/db/src/schema.ts` を書き換えてから `pnpm db:generate` を実行する。`packages/db/migrations/` にファイルができるので、commit する
- `pnpm db:migrate` で、まだ適用していないマイグレーションを DB に適用する

### ヘルスチェック

`GET http://localhost:3001/health` は、DB に `SELECT 1` を実行して結果を返す。

| 状態 | ステータス | 応答 |
|---|---|---|
| DB に接続できる | 200 | `{"status":"ok","db":"ok"}` |
| DB に接続できない | 503 | `{"status":"error","db":"error"}` |

