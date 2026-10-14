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
- 一意：`(from_user_id, to_user_id, server_id)`。申請は場（サーバー）ごとの別の行にする。同じ 2 人の間でも、向きや場が違えば別の申請として行を作り、申請者の送った申請の一覧にもそれぞれ出す（2 人の間に申請があるかどうかで、別のプロフィールが同じ人だと分からないようにするため）
- CHECK：`from_user_id <> to_user_id`（自分自身には申請できない）
- インデックス：`to_user_id`（届いた申請の一覧）、`from_user_id`（送った申請の一覧）
- アプリが守る
  - 申請できるのは、2 人がともに `server_id` のサーバーのメンバーのとき
  - 既にフレンドの相手には申請できない（フレンドどうしなので「既にフレンド」と返してよい）
  - 同じ場で同じ相手に二度申請した（一意に当たる）ときは「申請済み」と返してよい（申請者は同じプロフィールへの申請だと知っているので、何も漏れない）
  - 承認するときも、2 人がともに `server_id` のサーバーのメンバーで、サーバーが削除されていないかを確かめる。満たさなければ申請を消し、存在しない申請と同じ扱い（404）にする
  - 承認：2 人の間の申請をすべて消し、[`friendships`](friendships.md) に 2 行（申請者 → 相手は `from_profile_id`、相手 → 申請者は承認するときに選んだプロフィール）を同じ transaction で作る
  - 拒否・取り消し：行を消す（物理削除）

### 関係
- [`user`](user.md) 1 : 多 `friend_requests`（送った・受けた）
- [`servers`](servers.md) 1 : 多 `friend_requests`
- [`profiles`](profiles.md) 1 : 多 `friend_requests`
