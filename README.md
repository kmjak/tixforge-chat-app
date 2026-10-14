# chat-app

1 つのアカウントで複数のプロフィールを使い分けられる、リアルタイムチャットアプリ。サービスの概要は [docs/context/overview.md](docs/context/overview.md) を参照。

## 構成

pnpm workspaces の monorepo。

| パッケージ | 内容 |
|---|---|
| `apps/web` | Next.js（画面）。ポート 3000 |
| `apps/server` | Hono（API）。ポート 3001（環境変数 `PORT` で変更可） |
| `packages/shared` | web と server で共有する型 |
| `packages/db` | DB のスキーマ・クライアント（今は空） |

## セットアップ

Node.js のバージョンは `.nvmrc`（24）で、pnpm のバージョンは `package.json` の `packageManager` で固定している。

```sh
nvm install   # .nvmrc の Node.js を入れる
nvm use
corepack enable   # package.json で指定した pnpm を使う
pnpm install
```

## 開発

```sh
pnpm dev
```

web（http://localhost:3000）と server（http://localhost:3001）が同時に起動する。web のトップページには server の状態が表示される。web が接続する server の URL は、環境変数 `SERVER_URL`（既定 `http://localhost:3001`）で変えられる。

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
