# dms
## DM

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000017） |
| 目的 | フレンドとの 1 対 1 の会話の部屋。2 人の組に 1 つ |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `user_a_id` | `uuid` | 不可 | 2 人のうち、id の小さいほうのアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `user_b_id` | `uuid` | 不可 | 2 人のうち、id の大きいほうのアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `last_message_at` | `timestamptz` | 可 | 最後のメッセージの日時。メッセージが 1 通も無ければ null |
| `created_at` | `timestamptz` | 不可 | 作った日時 |

### キーと制約
- 主キー：`id`
- 外部キー：`user_a_id` → `user.id`、`user_b_id` → `user.id`
- 一意：`(user_a_id, user_b_id)`（同じ 2 人の DM は 1 つ）
- CHECK：`user_a_id < user_b_id`（2 人の並びを 1 通りにする）
- インデックス：`user_b_id`
- アプリが守る
  - フレンド（[`friendships`](friendships.md)）でない相手とは作れない
  - 最初にメッセージを送るか開くときに作る
  - メッセージを送るたびに、同じ transaction で `last_message_at` を更新する
  - DM の一覧は、`last_message_at` が null でないものだけを、新しい順に出す（グループ DM と合わせて並べる）
  - 2 人の表示には、それぞれが相手に割り当てたプロフィール（[`friendships`](friendships.md)`.profile_id`）を使う

### 関係
- [`user`](user.md) 1 : 多 `dms`（`user_a_id`・`user_b_id`）
- `dms` 1 : 多 [`messages`](messages.md)
