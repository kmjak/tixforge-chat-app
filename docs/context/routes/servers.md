# `/servers`
## サーバーの一覧

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=%2Fservers`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する |
| 権限 | ログインしていること（自分が参加しているサーバーだけを表示する） |
| パスパラメータ | なし |
| query | なし |
| 遷移可能先 | [`/home`](home.md)・[`/servers/{serverId}`](servers-{serverId}.md) |
| 呼び出す API | [`GET /api/servers`](../uri/get-api-servers.md)・[`POST /api/servers`](../uri/post-api-servers.md)・[`GET /api/profiles`](../uri/get-api-profiles.md) |

### 詳細
- 自分が参加しているサーバーの一覧（参加した順）を、オーナーかどうかと、そのサーバーで使っているプロフィールの名前付きで表示する。各サーバーから [`/servers/{serverId}`](servers-{serverId}.md) へ移る。
- 新しいサーバーの作成フォーム（サーバー名と、そのサーバーで使うプロフィール。初期値はデフォルトのプロフィール）を置く。作ったら、そのサーバーの画面へ移る。
- サーバー名が条件（[`POST /api/servers`](../uri/post-api-servers.md)）を満たさないときや、作成に失敗したときは、画面にエラーを表示する。
