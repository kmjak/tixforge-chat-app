# account
## ログインの方法とパスワード（Better Auth）

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| 目的 | アカウントのログインの方法。MVP ではメールアドレスとパスワードだけなので、1 つのアカウントに 1 行（`provider_id = 'credential'`）で、パスワードのハッシュを持つ |

Better Auth のテーブル。列は Better Auth が決める（主な列だけを書く。OAuth 用のトークンの列は MVP では使わない）。「アカウント」という概念は [`user`](user.md) で表し、このテーブルではない。

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `user_id` | `uuid` | 不可 | アカウント（[`user`](user.md)`.id`） |
| `account_id` | `text` | 不可 | ログインの方法の中での id（メールアドレスとパスワードでは `user_id` と同じ値） |
| `provider_id` | `text` | 不可 | ログインの方法（MVP では `credential` だけ） |
| `password` | `text` | 可 | パスワードのハッシュ。**誰にも見せない** |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- 外部キー：`user_id` → `user.id`（Better Auth が決める）
- インデックス：`user_id`

### 関係
- [`user`](user.md) 1 : 多 `account`（MVP では 1 : 1）
- 自前のテーブルからは参照しない
