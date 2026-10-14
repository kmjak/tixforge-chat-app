# group_dm_members
## グループ DM の招待・メンバーと、グループ DM で使うプロフィール

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000018） |
| 目的 | 誰がグループ DM に招待されているか・参加しているか・抜けたか、そのグループ DM でどのプロフィールを見せるか（[プロフィールの割り当て](../schema.md#プロフィールの割り当て)） |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `group_dm_id` | `uuid` | 不可 | グループ DM（[`group_dms`](group_dms.md)`.id`） |
| `user_id` | `uuid` | 不可 | アカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `status` | `text` | 不可 | `invited`（承認待ち）・`joined`（メンバー）・`left`（退出済み。予定（GT-000019）） |
| `profile_id` | `uuid` | 可 | そのグループ DM で使うプロフィール（[`profiles`](profiles.md)`.id`）。`joined` の間は必ずある。初めての招待の間は null。退出・再招待の後は「直前のプロフィール」として残り、そのプロフィールが削除されたら null になる |
| `invited_by_user_id` | `uuid` | 可 | 招待したアカウント（[`user`](user.md)`.id`）。作った人自身の行は null。**ほかのアカウントに見せない**。招待は、招待した人が招待された人に割り当てているプロフィール（[`friendships`](friendships.md)`.profile_id`）で届く |
| `invited_at` | `timestamptz` | 可 | 招待された日時（作った人自身の行は null） |
| `joined_at` | `timestamptz` | 可 | 参加（承認）した日時 |
| `left_at` | `timestamptz` | 可 | 退出した日時。予定（GT-000019） |
| `left_display_name` | `varchar(32)` | 可 | 退出したときのプロフィールの名前。退出した人の過去のメッセージを「（退出済み）」付きで表示するのに使う。予定（GT-000019） |

### キーと制約
- 主キー：`(group_dm_id, user_id)`
- 外部キー：`group_dm_id` → `group_dms.id`、`user_id` → `user.id`、`profile_id` → `profiles.id`（`ON DELETE SET NULL`）、`invited_by_user_id` → `user.id`
- CHECK：`status in ('invited', 'joined', 'left')`
- CHECK：`status <> 'joined' or profile_id is not null`
- CHECK：`status <> 'left' or left_at is not null`
- インデックス：`user_id`（自分のグループ DM と招待の一覧）、`profile_id`（プロフィールの使用先）
- アプリが守る
  - `invited` と `joined` を合わせて 10 人まで（[上限の数の守り方](../schema.md#命名と型の規則)のとおり、`group_dms` の行をロックしてから数える）
  - 招待できるのは `joined` のメンバーで、招待する相手は自分のフレンド
  - `invited` の人は、ほかのメンバーには表示しない
  - 承認：プロフィールを選び、`status = 'joined'`・`profile_id`・`joined_at` を入れ、`left_at`・`left_display_name` を null にする。参加のメッセージを出す
  - 拒否：以前メンバーだった行（`left_display_name` がある）は `status = 'left'` に戻し、それ以外は行を消す
  - 退出：`status = 'left'`・`left_at`・`left_display_name`（そのときのプロフィールの名前）を入れる。退出のメッセージを出す（予定（GT-000019））
  - 再び招待されたら、同じ行を `invited` にする。承認の画面の初期値は `profile_id`（null ならデフォルトのプロフィール）
  - 表示（メンバーの一覧・メッセージの送り手）：見る人がその人のフレンドなら、フレンドの割り当て（[フレンドが優先](../schema.md#プロフィールの割り当て)。退出済みなら「（退出済み）」を付ける）。それ以外は、`joined` なら `profile_id` のプロフィール、`left` と、再び招待されて承認待ちの間（`invited` で `left_display_name` がある）は `left_display_name` と「（退出済み）」

### 関係
- [`group_dms`](group_dms.md) 1 : 多 `group_dm_members`
- [`user`](user.md) 1 : 多 `group_dm_members`
- [`profiles`](profiles.md) 1 : 多 `group_dm_members`
