# friend_links
## フレンドリンク

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000016） |
| 目的 | 開いた人と、申請・承認を経ずにすぐフレンドになるリンク。作るときに、相手に見せる自分のプロフィールを決める |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー。URL には出さない |
| `token` | `text` | 不可 | URL に使うランダムなトークン（[id の規則](../schema.md#id-の規則)） |
| `user_id` | `uuid` | 不可 | 作ったアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `profile_id` | `uuid` | 不可 | フレンドになった相手に見せる、作った人のプロフィール（[`profiles`](profiles.md)`.id`）。リンクを開いた人にも、このプロフィールを見せる |
| `expires_at` | `timestamptz` | 可 | 有効期限。作るときに 1・6・12・24・48 時間後か、無制限（null）を選ぶ |
| `created_at` | `timestamptz` | 不可 | 作った日時 |

### キーと制約
- 主キー：`id`
- 一意：`token`
- 外部キー：`user_id` → `user.id`、`profile_id` → `profiles.id`（`ON DELETE CASCADE`。リンクのプロフィールは「使用中」に数えないので、削除するとリンクも消える）
- アプリが守る
  - 使える回数に上限は無い
  - 開いた人がプロフィールを選ぶと、[`friendships`](friendships.md) に 2 行（作った人 → 開いた人は `profile_id`、開いた人 → 作った人は選んだプロフィール）を作り、2 人の間の承認待ちの [`friend_requests`](friend_requests.md) をすべて消す。同じ transaction で行う
  - 自分のリンク・既にフレンドの相手のリンク・期限切れ・存在しないリンクでは、フレンドにならない（既にフレンドの相手には「既にフレンド」と返してよい）
- MVP では取り消しをしない

### 関係
- [`user`](user.md) 1 : 多 `friend_links`
- [`profiles`](profiles.md) 1 : 多 `friend_links`
