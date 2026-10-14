# messages
## メッセージ（チャンネル・DM・グループ DM）

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000014） |
| 目的 | チャンネル・DM・グループ DM に投稿するテキストと、参加・退出のメッセージ。送り手はアカウントで持ち、表示するたびに、その場で使っている今のプロフィールを引く |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `bigint` | 不可 | 主キー。連番（`generated always as identity`）。推測しやすいので、取得では必ず[参加者の確認](../schema.md#参加者の確認)を行う |
| `channel_id` | `uuid` | 可 | チャンネルのメッセージなら、そのチャンネル（[`channels`](channels.md)`.id`） |
| `dm_id` | `uuid` | 可 | DM のメッセージなら、その DM（[`dms`](dms.md)`.id`）。予定（GT-000017） |
| `group_dm_id` | `uuid` | 可 | グループ DM のメッセージなら、そのグループ DM（[`group_dms`](group_dms.md)`.id`）。予定（GT-000018） |
| `sender_user_id` | `uuid` | 不可 | 送り手のアカウント（[`user`](user.md)`.id`）。参加・退出のメッセージでは、参加・退出した人。**API の応答・WebSocket のイベントに含めない** |
| `kind` | `text` | 不可 | `text`（ふつうのメッセージ）・`join`（参加した）・`leave`（退出した。予定（GT-000010）） |
| `body` | `varchar(2000)` | 可 | 本文。`text` のときだけあり、1〜2000 文字（空白だけは不可）。`join`・`leave` では null |
| `created_at` | `timestamptz` | 不可 | 送った日時 |

### キーと制約
- 主キー：`id`
- 外部キー：`channel_id` → `channels.id`、`dm_id` → `dms.id`、`group_dm_id` → `group_dms.id`、`sender_user_id` → `user.id`
- CHECK：`num_nonnulls(channel_id, dm_id, group_dm_id) = 1`（部屋はどれか 1 つ）
- CHECK：`kind in ('text', 'join', 'leave')`
- CHECK：`(kind = 'text') = (body is not null)`、`body is null or char_length(body) between 1 and 2000`
- インデックス（部分インデックス）：`(channel_id, id desc)`（`channel_id` がある行）、`(dm_id, id desc)`（`dm_id` がある行）、`(group_dm_id, id desc)`（`group_dm_id` がある行）
- アプリが守る
  - 取得・送信の前に、[参加者の確認](../schema.md#参加者の確認)を行う。削除したチャンネルのメッセージは取得も送信もできない
  - 本文の前後の空白を取り除き、空なら送れない
  - 取得は新しい順に 50 件ずつ。続きは、前に受け取った中で最も小さい `id` より小さいものを取る
  - DM・グループ DM に送ったら、同じ transaction で `dms.last_message_at`・`group_dms.last_message_at` を更新する
  - 参加のメッセージ（`join`）は、サーバーに参加したら既定のチャンネルに、グループ DM に参加したらそのグループ DM に出す。退出のメッセージ（`leave`）も同じ場所に出す
  - MVP では編集・削除をしない
- 送り手の表示（`sender_user_id` から引く）
  - チャンネル：そのサーバーの [`server_members`](server_members.md)。メンバーなら `profile_id` のプロフィール、退出済みなら `left_display_name` と「（退出済み）」
  - DM：送り手が相手に割り当てたプロフィール（[`friendships`](friendships.md) の 送り手 → 相手 の行の `profile_id`）
  - グループ DM：[`group_dm_members`](group_dm_members.md)。`joined` なら `profile_id` のプロフィール、それ以外（`left`、再び招待されて承認待ち）は `left_display_name` と「（退出済み）」

### 関係
- [`channels`](channels.md)・[`dms`](dms.md)・[`group_dms`](group_dms.md) 1 : 多 `messages`（どれか 1 つに属する）
- [`user`](user.md) 1 : 多 `messages`（送り手）
