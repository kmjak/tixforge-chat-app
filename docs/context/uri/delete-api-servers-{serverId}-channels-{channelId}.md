# `DELETE /api/servers/{serverId}/channels/{channelId}`
## チャンネルの削除

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011） |
| メソッド | DELETE |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのオーナーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/servers/{serverId}/channels/{channelId}`](../routes/servers-{serverId}-channels-{channelId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

論理削除する（[schema の `channels`](../schema/channels.md)）。削除したチャンネルは、一覧・取得・メッセージの対象から外れ、上限の数に含めない。MVP では復元しない。

### http status
#### 204 削除した
本文なし。

#### 403 オーナーでない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_SERVER_OWNER`（メンバーだがオーナーでない。メンバーにはサーバーとチャンネルが見えているので、存在を隠さずに理由を返す）

#### 404 メンバーでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メンバーでなければ、サーバーやチャンネルが存在しても 404 にする（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。削除したチャンネルも 404。

#### 409 既定のチャンネル
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`CHANNEL_IS_DEFAULT`（既定のチャンネルは削除できない。サーバーに常に 1 つ以上のチャンネルがあるように）
