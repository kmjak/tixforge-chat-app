# `/servers/{serverId}/channels/{channelId}`
## チャンネル

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011。メッセージは GT-000014） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=<開こうとしたパスを URL エンコード>`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する。メンバーでない・存在しない・削除したチャンネルは、Next.js の 404 の画面を表示する |
| 権限 | そのサーバーのメンバーであること。名前の変更・削除はオーナーだけ |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/servers/{serverId}`](servers-{serverId}.md) |
| 呼び出す API | [`GET /api/servers/{serverId}`](../uri/get-api-servers-{serverId}.md)・[`GET /api/servers/{serverId}/channels/{channelId}`](../uri/get-api-servers-{serverId}-channels-{channelId}.md)・[`PATCH /api/servers/{serverId}/channels/{channelId}`](../uri/patch-api-servers-{serverId}-channels-{channelId}.md)・[`DELETE /api/servers/{serverId}/channels/{channelId}`](../uri/delete-api-servers-{serverId}-channels-{channelId}.md)・[`GET /api/servers/{serverId}/channels/{channelId}/messages`](../uri/get-api-servers-{serverId}-channels-{channelId}-messages.md)・[`POST /api/servers/{serverId}/channels/{channelId}/messages`](../uri/post-api-servers-{serverId}-channels-{channelId}-messages.md)・WebSocket の [`message.created`](../ws.md#イベントの一覧) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `serverId` | string | サーバーの id（UUID） |
| `channelId` | string | チャンネルの id（UUID） |

### 詳細
- チャンネルの名前と、サーバーの画面へ戻るリンクを表示する。
- オーナーなら、名前の変更と削除ができる。削除したらサーバーの画面へ戻る。既定のチャンネルは、削除の代わりに削除できない理由を表示する。オーナーでないメンバーには、変更・削除を出さない。
- メッセージの欄と送信のフォームを表示する（GT-000014）。
  - 最初は最新の 50 件を、古い順（新しいものが下）に表示し、一番下までスクロールしておく。
  - 欄の一番上までスクロールすると、次の 50 件を読み込む。読み込んでも、見ていたメッセージの位置はずらさない。一番古いところまで来たら「これより前のメッセージはありません」と表示する。
  - 各メッセージには、送り手の名前（見る人に見せるプロフィール。幅を超えたら「…」で省略）・送った日時（今日なら時刻、それより前なら日付と時刻。ブラウザのタイムゾーン）・本文を表示する。参加のメッセージは「〇〇 が参加しました」。
  - WebSocket の `message.created`（このチャンネルの部屋）で、再読み込みなしで新しいメッセージを足す。一番下を見ていたら、足した後も一番下にする。自分が送ったものは、API の応答とイベントの両方で届くので、id で 1 つにする。
  - 画面を開いたとき（読み込んでから WebSocket の購読を始めるまでの分）と、再接続したとき（`ready`。切れていた間の分）に、最新の 50 件を読み直して足す。読み直したページと、読み直しを始めた時点の画面の間に読んでいないものがあれば（画面が空だったときも）、抜けたまま並ばないよう、画面をそのページで置き換える（読み直しの間に届いたものは残す。さかのぼりで読み直せる。置き換える前に始めたさかのぼりの結果は捨てる）。読み直しが 404（チャンネルが削除された・退出していた）なら、画面を読み込み直して 404 の画面にする。
  - 日時の文字列はブラウザで描画した後に作る（Next.js のサーバーとブラウザのタイムゾーンが違っても、表示が食い違わないように）。
  - 送り手がプロフィールを変えても、開いている画面の名前は書き換えない（開き直したときに今のプロフィールで表示する）。
