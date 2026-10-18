# `PATCH /api/servers/{serverId}/channels/{channelId}`
## チャンネル名の変更

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011） |
| メソッド | PATCH |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのオーナーであること |
| パスパラメータ | 下の表 |
| リクエスト | 下の表（JSON） |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}/channels/{channelId}`](../routes/servers-{serverId}-channels-{channelId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `name` | string | はい | チャンネル名。前後の空白を除いて 1〜100 文字で、文字（あらゆる言語。結合文字を含む）・数字・`-`・`_` だけ。スペース・記号・絵文字は使えない。除いた値で保存する。同じサーバーの中で重複してもよい |

既定のチャンネルの名前も変えられる。

### http status
#### 200 変えた後のチャンネル

`Channel`（[`GET /api/servers/{serverId}/channels`](get-api-servers-{serverId}-channels.md) と同じ形）

#### 400 名前が規則に合わない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_CHANNEL_NAME`（ほかに、本文が JSON のオブジェクトでなければ `BAD_REQUEST`）

#### 403 オーナーでない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_SERVER_OWNER`（メンバーだがオーナーでない。メンバーにはサーバーとチャンネルが見えているので、存在を隠さずに理由を返す）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやチャンネルが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したチャンネルも 404。
