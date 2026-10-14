# user
## アカウント（Better Auth）

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| 目的 | ログインの単位であるアカウント。1 人に 1 つ。Better Auth が作り、読み書きする |

Better Auth のテーブルなので、列は Better Auth が決める。ここでは、自前のテーブルとの関係に要る列と主な列だけを書く（列名は実際の DB の列名。TS（Drizzle）のプロパティ名は Better Auth のフィールド名の camelCase）。

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー。アカウントの id。Better Auth の id の生成を UUID にする設定で作る。**ほかのアカウントに見せない** |
| `name` | `text` | 不可 | サインアップで入力した名前。デフォルトのプロフィールの名前の初期値に使う。**ほかのアカウントに見せない**（ほかの人にはプロフィールの名前を見せる） |
| `email` | `text` | 不可 | メールアドレス。**ほかのアカウントに見せない** |
| `email_verified` | `boolean` | 不可 | メールアドレスを確認済みか（MVP では確認しないので常に false） |
| `image` | `text` | 可 | 画像（MVP では使わないので null） |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- 一意：`email`（Better Auth が守る）

### 関係
- 自前のテーブルは、アカウントを `user_id`（または役割を付けた `*_user_id`）で参照する：[`profiles`](profiles.md)・[`servers`](servers.md)・[`server_members`](server_members.md)・[`server_invites`](server_invites.md)・[`friend_requests`](friend_requests.md)・[`friendships`](friendships.md)・[`friend_links`](friend_links.md)・[`dms`](dms.md)・[`group_dm_members`](group_dm_members.md)・[`messages`](messages.md)
- Better Auth のテーブル：[`session`](session.md)・[`account`](account.md) が `user_id` で参照する
- MVP ではアカウントを削除しないので、参照する側の削除時の動き（`ON DELETE`）は決めない
