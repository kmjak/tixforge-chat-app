# `GET /api/servers/{serverId}/channels`
## チャンネルの一覧

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011。カテゴリは GT-000012） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのメンバーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| ページネーション | なし（カテゴリは 5 個まで、各カテゴリ・カテゴリに属さないチャンネルは 10 個まで） |
| 呼び出し元 URL | [`/servers/{serverId}`](../routes/servers-{serverId}.md)・[`/servers/{serverId}/channel-order`](../routes/servers-{serverId}-channel-order.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |

削除したカテゴリ・チャンネルは含めない。並び順は、カテゴリもチャンネル（同じ並びの中）も `position`、同じなら `created_at` の順。

### http status
#### 200 一覧

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `channels` | `Channel[]` | はい | カテゴリに属さないチャンネル |
| `categories` | `Category[]` | はい | カテゴリ（中が空のものも含む） |

`Channel`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | string | はい | チャンネルの id（UUID） |
| `name` | string | はい | チャンネル名 |
| `isDefault` | boolean | はい | 既定のチャンネル（`一般`）か |

`Category`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | string | はい | カテゴリの id（UUID） |
| `name` | string | はい | カテゴリ名 |
| `channels` | `Channel[]` | はい | カテゴリの中のチャンネル |

```json
{
  "channels": [
    { "id": "3f1a…", "name": "一般", "isDefault": true }
  ],
  "categories": [
    { "id": "5d7e…", "name": "ゲーム", "channels": [
      { "id": "8c2b…", "name": "雑談", "isDefault": false }
    ] }
  ]
}
```

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやチャンネルが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したチャンネルも 404。
