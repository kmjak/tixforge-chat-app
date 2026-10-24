# `PUT /api/servers/{serverId}/channel-layout`
## 並び順の保存

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000012） |
| メソッド | PUT |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのオーナーであること |
| パスパラメータ | 下の表 |
| リクエスト | 下の表（JSON） |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}/channel-order`](../routes/servers-{serverId}-channel-order.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `channels` | string[] | はい | カテゴリに属さないチャンネルの id を、並べたい順に |
| `categories` | `{ id: string, channels: string[] }[]` | はい | カテゴリの id を並べたい順に、それぞれの中のチャンネルの id も並べたい順に |

```json
{
  "channels": ["3f1a…"],
  "categories": [
    { "id": "5d7e…", "channels": ["8c2b…", "9a0c…"] },
    { "id": "1b2c…", "channels": [] }
  ]
}
```

- 今の削除していないカテゴリとチャンネルを、すべて 1 回ずつ並べる。チャンネルを別の並びに書けば、そのカテゴリに入れる・出す・移すことになる
- 受け取った順で、カテゴリとチャンネル（並びごと）の `position` を 1 から振り直す
- 1 つのカテゴリ・カテゴリに属さないチャンネルは、それぞれ 10 個まで

### http status
#### 200 保存した

保存した後の一覧（[`GET /api/servers/{serverId}/channels`](get-api-servers-{serverId}-channels.md) の 200 と同じ形）

#### 400 形が違う
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_LAYOUT`（形が違う、id が UUID の形でない、同じ id が 2 回ある）（ほかに、本文が JSON のオブジェクトでなければ `BAD_REQUEST`）

#### 403 オーナーでない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_SERVER_OWNER`（メンバーだがオーナーでない）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）

#### 409 並びが古い・上限
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：
- `LAYOUT_OUTDATED` — 並べた id の集まりが、今の削除していないカテゴリ・チャンネルと違う（並びを読み込んだ後に、作成・削除があった）。何も変えない。読み込み直して並べ直す
- `CHANNEL_LIMIT_REACHED` — どれかの並びが 10 個を超える
