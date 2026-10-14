# server_invites
## サーバーの招待リンク

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000009） |
| 目的 | サーバーに参加するための招待リンク。メンバーなら誰でも作れる。URL には推測できないトークンを使う |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー。URL には出さない |
| `token` | `text` | 不可 | URL に使うランダムなトークン（[id の規則](../schema.md#id-の規則)） |
| `server_id` | `uuid` | 不可 | 参加する先のサーバー（[`servers`](servers.md)`.id`） |
| `created_by_user_id` | `uuid` | 不可 | 作ったアカウント（[`user`](user.md)`.id`）。**ほかのアカウントに見せない** |
| `expires_at` | `timestamptz` | 可 | 有効期限。作るときに 1・6・12・24・48 時間後か、無制限（null）を選ぶ |
| `created_at` | `timestamptz` | 不可 | 作った日時 |

### キーと制約
- 主キー：`id`
- 一意：`token`
- 外部キー：`server_id` → `servers.id`、`created_by_user_id` → `user.id`
- アプリが守る
  - 使える回数に上限は無い
  - 期限切れ（`expires_at <= now()`）・存在しない・サーバーが削除されたリンクでは参加できない
  - 既に参加しているサーバーのリンクを開いても、二重に参加しない
- MVP では取り消し・削除をしない

### 関係
- [`servers`](servers.md) 1 : 多 `server_invites`
- [`user`](user.md) 1 : 多 `server_invites`（作った人）
