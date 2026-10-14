# friendships
## フレンドと、相手に見せるプロフィール

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000015） |
| 目的 | フレンドの関係と、各自が相手に見せるプロフィール（[プロフィールの割り当て](../schema.md#プロフィールの割り当て)）。1 組のフレンドを、向きごとに 2 行で持つ。DM でもこの割り当てを使う |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `user_id` | `uuid` | 不可 | この行の持ち主のアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `friend_user_id` | `uuid` | 不可 | フレンドのアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `profile_id` | `uuid` | 不可 | `user_id` の人が `friend_user_id` の人に見せるプロフィール（[`profiles`](profiles.md)`.id`）。後から変えられる |
| `created_at` | `timestamptz` | 不可 | フレンドになった日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時（見せるプロフィールの変更） |

### キーと制約
- 主キー：`(user_id, friend_user_id)`
- 外部キー：`user_id` → `user.id`、`friend_user_id` → `user.id`、`profile_id` → `profiles.id`（使用中のプロフィールは削除できないので、削除時の動きは既定（拒否）のまま）
- CHECK：`user_id <> friend_user_id`
- インデックス：`profile_id`（プロフィールの使用先）、`friend_user_id`（相手の行を引く）
- アプリが守る
  - 2 行（A → B と B → A）を必ず同じ transaction で作る。片方だけの行を作らない
  - `profile_id` は、`user_id` の人のプロフィールだけ
  - 自分のフレンドの一覧では、相手の行（`user_id` = 相手、`friend_user_id` = 自分）の `profile_id` で相手を表示する
  - サーバー・グループ DM の中でも、見る人がフレンドなら、この割り当てで表示する（[フレンドが優先](../schema.md#プロフィールの割り当て)）
- MVP ではフレンドの削除をしない

### 関係
- [`user`](user.md) 1 : 多 `friendships`（両側）
- [`profiles`](profiles.md) 1 : 多 `friendships`
- [`dms`](dms.md)：DM の 2 人の表示に、この割り当てを使う（外部キーでは結ばない）
