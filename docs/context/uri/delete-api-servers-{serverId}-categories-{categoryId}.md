# `DELETE /api/servers/{serverId}/categories/{categoryId}`
## カテゴリの削除

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000012） |
| メソッド | DELETE |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのオーナーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}/channel-order`](../routes/servers-{serverId}-channel-order.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `categoryId` | string | カテゴリの id（UUID） |

論理削除する。中の削除していないチャンネルも、同じ transaction で論理削除する（一覧・取得から消える）。中に既定のチャンネルがあるカテゴリは削除できない。

### http status
#### 204 削除した
本文なし

#### 403 オーナーでない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_SERVER_OWNER`（メンバーだがオーナーでない。メンバーにはサーバーとカテゴリが見えているので、存在を隠さずに理由を返す）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやカテゴリが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したカテゴリも 404。

#### 409 既定のチャンネルが入っている
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`CATEGORY_HAS_DEFAULT_CHANNEL`（先に既定のチャンネルを、[`PUT /api/servers/{serverId}/channel-layout`](put-api-servers-{serverId}-channel-layout.md) でほかの並びへ移す）
