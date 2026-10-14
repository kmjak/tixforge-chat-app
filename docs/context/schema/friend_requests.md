# friend_requests
## フレンド申請

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000015） |
| 目的 | 承認待ちのフレンド申請。同じサーバーのメンバーに送る。承認・拒否・取り消しで行を消す |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー。承認・拒否・取り消しの API で申請を指すのに使う |
| `from_user_id` | `uuid` | 不可 | 申請したアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `to_user_id` | `uuid` | 不可 | 申請を受けたアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `server_id` | `uuid` | 不可 | 申請した場のサーバー（[`servers`](servers.md)`.id`） |
| `from_profile_id` | `uuid` | 不可 | 相手に見せる申請者のプロフィール（[`profiles`](profiles.md)`.id`）。申請したときの、そのサーバーでの申請者のプロフィール。承認されたら、申請者が相手に見せるプロフィール（[`friendships`](friendships.md)`.profile_id`）になる |
| `created_at` | `timestamptz` | 不可 | 申請した日時 |

### キーと制約
- 主キー：`id`
- 外部キー：`from_user_id` → `user.id`、`to_user_id` → `user.id`、`server_id` → `servers.id`、`from_profile_id` → `profiles.id`（`ON DELETE CASCADE`。申請者がそのプロフィールを削除したら、申請も消える）
- 一意（式インデックス）：`(least(from_user_id, to_user_id), greatest(from_user_id, to_user_id))`。同じ 2 人の間の承認待ちの申請は、向きにかかわらず 1 つまで
- CHECK：`from_user_id <> to_user_id`（自分自身には申請できない）
- インデックス：`to_user_id`（届いた申請の一覧）
- アプリが守る
  - 申請できるのは、2 人がともに `server_id` のサーバーのメンバーのとき
  - 既にフレンドの相手には申請できない
  - 承認：申請を消し、[`friendships`](friendships.md) に 2 行（申請者 → 相手は `from_profile_id`、相手 → 申請者は承認するときに選んだプロフィール）を同じ transaction で作る
  - 拒否・取り消し：行を消す（物理削除）

### 関係
- [`user`](user.md) 1 : 多 `friend_requests`（送った・受けた）
- [`servers`](servers.md) 1 : 多 `friend_requests`
- [`profiles`](profiles.md) 1 : 多 `friend_requests`
