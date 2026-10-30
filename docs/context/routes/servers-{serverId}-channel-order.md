# `/servers/{serverId}/channel-order`
## カテゴリと並び順

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000012） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=<開こうとしたパスを URL エンコード>`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する。メンバーでない・存在しないサーバーは、Next.js の 404 の画面を表示する。オーナーでないメンバーには「オーナーだけが変えられる」ことだけを表示する |
| 権限 | そのサーバーのオーナーであること |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/servers/{serverId}`](servers-{serverId}.md) |
| 呼び出す API | [`GET /api/servers/{serverId}`](../uri/get-api-servers-{serverId}.md)・[`GET /api/servers/{serverId}/channels`](../uri/get-api-servers-{serverId}-channels.md)・[`PUT /api/servers/{serverId}/channel-layout`](../uri/put-api-servers-{serverId}-channel-layout.md)・[`POST /api/servers/{serverId}/categories`](../uri/post-api-servers-{serverId}-categories.md)・[`PATCH /api/servers/{serverId}/categories/{categoryId}`](../uri/patch-api-servers-{serverId}-categories-{categoryId}.md)・[`DELETE /api/servers/{serverId}/categories/{categoryId}`](../uri/delete-api-servers-{serverId}-categories-{categoryId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |

### 詳細
- 並び順：「カテゴリなし」と各カテゴリの並びを出す。カテゴリとチャンネルには ↑↓ のボタン、チャンネルには入るカテゴリの選択（選ぶと、その並びの末尾へ移る）を置く。並びは画面の中だけで変え、「保存」でまとめて送る。「元に戻す」で保存した並びに戻す
  - 保存の前に、10 個を超える並びがあれば止めて伝える
  - 並びを読み込んだ後にカテゴリ・チャンネルが作成・削除されていたら（`LAYOUT_OUTDATED`）、そう伝えて読み込み直す
- カテゴリ：作成（5 個まで）・名前の変更・削除（中のチャンネルも削除）。その場で送って読み込み直す。既定のチャンネルが入っているカテゴリには、削除の代わりに理由を出す
  - 保存していない並びがある間は、カテゴリの操作を押せないようにする（読み込み直すと、保存していない並びが消えるため）
- ドラッグ&ドロップは対象外（別のチケットで足す）
