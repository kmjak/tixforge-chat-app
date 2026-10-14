# profiles
## プロフィール

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| 目的 | アカウントの下に複数作れる「顔」。サーバー・フレンド・グループ DM ごとに、どれを見せるかを選ぶ（[schema.md の「プロフィールの割り当て」](../schema.md#プロフィールの割り当て)） |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー。ほかの人を API で指すときにも使う |
| `user_id` | `uuid` | 不可 | 持ち主のアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `name` | `varchar(32)` | 不可 | 名前。1〜32 文字（前後の空白を取り除いて数える）。同じアカウントの中で重複してもよい |
| `bio` | `varchar(190)` | 不可 | 自己紹介。0〜190 文字。既定値は空文字 |
| `is_default` | `boolean` | 不可 | デフォルトのプロフィールか。既定値は false |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- 外部キー：`user_id` → `user.id`
- 一意（部分インデックス）：`user_id`（`is_default = true` の行だけ）。デフォルトは 1 つのアカウントに 1 つまで
- CHECK：`char_length(name) between 1 and 32`、`char_length(bio) <= 190`
- インデックス：`user_id`
- アプリが守る（transaction の中で確かめる）
  - 1 つのアカウントのプロフィールは 5 個まで（デフォルトを含む）
  - デフォルトは常にちょうど 1 つ（サインアップで作り、切り替えは 1 つの transaction で入れ替える）
  - デフォルトと、使用中（[schema.md の「プロフィールの割り当て」](../schema.md#プロフィールの割り当て)）のプロフィールは削除できない
- 削除は物理削除。使用中は削除できないので、消して困る参照は無い。退出済みの行が持つ「直前のプロフィール」は `ON DELETE SET NULL` で外れる

### 関係
- [`user`](user.md) 1 : 多 `profiles`
- `profiles` を参照するテーブル：[`server_members`](server_members.md)・[`friendships`](friendships.md)・[`group_dm_members`](group_dm_members.md)（割り当て）、[`friend_requests`](friend_requests.md)・[`friend_links`](friend_links.md)（相手に見せるプロフィール）
