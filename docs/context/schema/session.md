# session
## ログインのセッション（Better Auth）

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| 目的 | ログインのセッション。DB に保存し、cookie のトークンと照らし合わせてログイン状態を判定する |

Better Auth のテーブル。列は Better Auth が決める（主な列だけを書く）。

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `user_id` | `uuid` | 不可 | ログインしているアカウント（[`user`](user.md)`.id`） |
| `token` | `text` | 不可 | セッションのトークン（cookie に入る）。**ほかのアカウントに見せない** |
| `expires_at` | `timestamptz` | 不可 | 期限 |
| `ip_address` | `text` | 可 | ログインしたときの IP アドレス |
| `user_agent` | `text` | 可 | ログインしたときのブラウザ |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- 一意：`token`
- 外部キー：`user_id` → `user.id`（Better Auth が決める）
- インデックス：`user_id`

### 関係
- [`user`](user.md) 1 : 多 `session`（1 つのアカウントが複数のブラウザでログインできる）
- 自前のテーブルからは参照しない
