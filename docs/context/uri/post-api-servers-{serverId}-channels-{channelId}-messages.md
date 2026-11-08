# `POST /api/servers/{serverId}/channels/{channelId}/messages`
## メッセージの送信

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000014） |
| メソッド | POST |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのメンバーであること |
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
| `body` | string | はい | 本文。前後の空白を除いて 1〜2000 文字（空白だけは不可）。除いた値で保存する |

送ったメッセージは、WebSocket でそのチャンネルの部屋に [`message.created`](../ws.md#イベントの一覧) として届ける（送った本人の接続にも届く）。配るのに失敗しても、メッセージは保存済みなので 201 を返す。

### http status
#### 201 送った

`Message`（[`GET .../messages`](get-api-servers-{serverId}-channels-{channelId}-messages.md) と同じ形）

#### 400 本文が規則に合わない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_MESSAGE`（ほかに、本文が JSON のオブジェクトでなければ `BAD_REQUEST`）

#### 404 メンバーでない・存在しない・削除したチャンネル
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メッセージの id は連番で推測しやすいので、取得・送信のたびに、呼び出した人がそのサーバーの今のメンバーで、チャンネルが同じサーバーにあり削除されていないことを確かめる（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。
