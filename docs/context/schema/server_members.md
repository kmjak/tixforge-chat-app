# server_members
## サーバーのメンバーと、サーバーで使うプロフィール

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000009） |
| 目的 | どのアカウントがどのサーバーのメンバーか、そのサーバーでどのプロフィールを見せるか（[プロフィールの割り当て](../schema.md#プロフィールの割り当て)）。退出した人も、過去のメッセージの表示と再参加のために行を残す |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `server_id` | `uuid` | 不可 | サーバー（[`servers`](servers.md)`.id`） |
| `user_id` | `uuid` | 不可 | メンバーのアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `profile_id` | `uuid` | 可 | そのサーバーで使うプロフィール（[`profiles`](profiles.md)`.id`）。メンバーの間は必ずある。退出した後は「直前のプロフィール」として残り、そのプロフィールが削除されたら null になる |
| `joined_at` | `timestamptz` | 不可 | 参加した日時（再参加したら更新する） |
| `left_at` | `timestamptz` | 可 | 退出した日時。null ならメンバー。予定（GT-000010） |
| `left_display_name` | `varchar(32)` | 可 | 退出したときのプロフィールの名前。退出した人の過去のメッセージを「（退出済み）」付きで表示するのに使い、以後変わらない。予定（GT-000010） |

### キーと制約
- 主キー：`(server_id, user_id)`（同じサーバーに二重に参加しない。再参加は同じ行を戻す）
- 外部キー：`server_id` → `servers.id`、`user_id` → `user.id`、`profile_id` → `profiles.id`（`ON DELETE SET NULL`）
- CHECK：`left_at is not null or profile_id is not null`（メンバーの間はプロフィールがある）
- CHECK：`left_at is not null or left_display_name is null`
- インデックス：`user_id`（自分のサーバーの一覧）、`profile_id`（プロフィールの使用先）
- アプリが守る
  - 参加・プロフィールの変更で選べるのは、自分のプロフィールだけ
  - 退出：`left_at` と `left_display_name`（そのときのプロフィールの名前）を入れる。`profile_id` は残す。オーナーは譲渡するまで退出できない（予定（GT-000010））
  - 再参加：同じ行の `left_at`・`left_display_name` を null にし、`profile_id` を選んだプロフィールにし、`joined_at` を更新する。選ぶ画面の初期値は `profile_id`（null ならデフォルトのプロフィール）
  - メッセージの送り手の表示：メンバーなら `profile_id` のプロフィール、退出済みなら `left_display_name` と「（退出済み）」

### 関係
- [`servers`](servers.md) 1 : 多 `server_members`
- [`user`](user.md) 1 : 多 `server_members`
- [`profiles`](profiles.md) 1 : 多 `server_members`（同じプロフィールを複数のサーバーで使える）
