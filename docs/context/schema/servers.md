# servers
## サーバー

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000009） |
| 目的 | Discord のようなコミュニティの単位。中にチャンネルを持つ。作った人がオーナーになる |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `name` | `varchar(100)` | 不可 | サーバー名。1〜100 文字（前後の空白を取り除いて数える） |
| `owner_user_id` | `uuid` | 不可 | オーナーのアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない**（オーナーを見せるときは、オーナーのそのサーバーでのプロフィールを見せる） |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |
| `deleted_at` | `timestamptz` | 可 | 削除した日時（論理削除）。null なら削除されていない。予定（GT-000010） |

### キーと制約
- 主キー：`id`
- 外部キー：`owner_user_id` → `user.id`
- CHECK：`char_length(name) between 1 and 100`
- アプリが守る
  - オーナーは、そのサーバーのメンバー（[`server_members`](server_members.md) で `left_at` が null）である。作るときに、オーナーをメンバーとして同じ transaction で加える
  - 作るときに、既定のチャンネル `一般`（[`channels`](channels.md) の `is_default = true`）を同じ transaction で作る（GT-000011 から。`channels` のテーブルを作る GT-000011 より前に作られたサーバーには、GT-000011 のマイグレーションで作る）
  - オーナーの譲渡は `owner_user_id` を書き換える。相手はそのサーバーのメンバーに限る（予定（GT-000010））
  - 削除は論理削除（予定（GT-000010））。同じ transaction で、全メンバーを退出の扱い（`server_members.left_at`・`left_display_name` を入れる）にする。プロフィールの使用先から外し、プロフィールを削除できるようにするため。削除したサーバーは、誰も取得できず、その招待リンクでも参加できない

### 関係
- [`user`](user.md) 1 : 多 `servers`（オーナー）
- `servers` 1 : 多 [`server_members`](server_members.md)・[`server_invites`](server_invites.md)・[`channels`](channels.md)・[`channel_categories`](channel_categories.md)
- `servers` 1 : 多 [`friend_requests`](friend_requests.md)（申請した場）
