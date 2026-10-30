# `PATCH /api/servers/{serverId}/categories/{categoryId}`
## カテゴリ名の変更

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000012） |
| メソッド | PATCH |
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
| `categoryId` | string | カテゴリの id（UUID） |

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `name` | string | はい | カテゴリ名。規則はチャンネル名と同じ（前後の空白を除いて 1〜100 文字で、文字（あらゆる言語。結合文字を含む）・数字・`-`・`_` だけ。[規則](../schema/channels.md#キーと制約)）。除いた値で保存する。同じサーバーの中で重複してもよい |

### http status
#### 200 変えた

[`POST /api/servers/{serverId}/categories`](post-api-servers-{serverId}-categories.md) の 201 と同じ形

#### 400 名前が規則に合わない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_CATEGORY_NAME`（ほかに、本文が JSON のオブジェクトでなければ `BAD_REQUEST`）

#### 403 オーナーでない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_SERVER_OWNER`（メンバーだがオーナーでない。メンバーにはサーバーとカテゴリが見えているので、存在を隠さずに理由を返す）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやカテゴリが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したカテゴリも 404。
