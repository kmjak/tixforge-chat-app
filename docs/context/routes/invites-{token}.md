# `/invites/{token}`
## 招待

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=%2Finvites%2F<token>`（[`/sign-in`](sign-in.md)）へリダイレクトする。サインイン（またはサインアップ。`redirect` を引き継ぐ）の後に、この画面へ戻る |
| ログイン済み時の動き | 表示する |
| 権限 | ログインしていること（招待リンクを知っていること） |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/servers/{serverId}`](servers-{serverId}.md)・[`/servers`](servers.md) |
| 呼び出す API | [`GET /api/invites/{token}`](../uri/get-api-invites-{token}.md)・[`POST /api/invites/{token}/join`](../uri/post-api-invites-{token}-join.md)・[`GET /api/profiles`](../uri/get-api-profiles.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `token` | string | 招待リンクのトークン（[schema の `server_invites`](../schema/server_invites.md)） |

### 詳細
- サーバーの名前と招待の有効期限を表示し、このサーバーで使うプロフィール（初期値はデフォルトのプロフィール）を選んで「参加」できる。参加したら、そのサーバーの画面へ移る。
- 既にメンバーなら、その旨と、サーバーの画面へのリンクを表示する（二重に参加しない）。
- 期限切れ・存在しない招待リンクなら、その旨を表示する（404 の画面にはしない）。
