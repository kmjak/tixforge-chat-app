# `GET /api/servers/{serverId}/channels/{channelId}/messages`
## チャンネルのメッセージの一覧

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000014） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | そのサーバーのメンバーであること |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | 下の表 |
| ページネーション | 新しい順に 50 件。続きは `before` に、受け取った中で最も小さい `id` を付けて呼ぶ |
| 呼び出し元 URL | [`/servers/{serverId}/channels/{channelId}`](../routes/servers-{serverId}-channels-{channelId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

### query

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `before` | number | いいえ | この id より古いメッセージを取る。省略したら最新から |

### http status
#### 200 一覧

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `messages` | `Message[]` | はい | 新しい順に最大 50 件 |
| `hasMore` | boolean | はい | これより古いメッセージがあるか |

`Message`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | number | はい | メッセージの id（連番） |
| `kind` | string | はい | `text`（ふつうのメッセージ）・`join`（サーバーに参加した） |
| `body` | `string \| null` | はい | 本文。`join` では null |
| `sender` | `Sender` | はい | 送り手。見る人に見せるプロフィール（[送り手の表示](../schema/messages.md#キーと制約)）。**アカウントの id は含めない** |
| `createdAt` | string | はい | 送った日時（ISO 8601） |

`Sender`

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `id` | `string \| null` | はい | プロフィールの id。サーバーを退出した人は null（GT-000010） |
| `name` | string | はい | 表示する名前。退出した人は、退出したときの名前と「（退出済み）」 |

```json
{
  "messages": [
    { "id": 42, "kind": "text", "body": "こんにちは", "sender": { "id": "9d0f…", "name": "たろう" }, "createdAt": "2026-10-30T05:05:00.000Z" },
    { "id": 41, "kind": "join", "body": null, "sender": { "id": "9d0f…", "name": "たろう" }, "createdAt": "2026-10-30T05:00:00.000Z" }
  ],
  "hasMore": false
}
```

#### 400 `before` が正しくない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`INVALID_CURSOR`（正の整数でない）

#### 404 メンバーでない・存在しない・削除したチャンネル
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。メッセージの id は連番で推測しやすいので、取得・送信のたびに、呼び出した人がそのサーバーの今のメンバーで、チャンネルが同じサーバーにあり削除されていないことを確かめる（[schema.md の「参加者の確認」](../schema.md#参加者の確認)）。
