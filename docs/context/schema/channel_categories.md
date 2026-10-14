# channel_categories
## チャンネルのカテゴリ

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000012） |
| 目的 | サーバーの中のチャンネルをまとめる単位。カテゴリの順と、カテゴリの中のチャンネルの順を変えられる |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `server_id` | `uuid` | 不可 | サーバー（[`servers`](servers.md)`.id`） |
| `name` | `varchar(100)` | 不可 | カテゴリ名。規則はチャンネル名と同じ |
| `position` | `integer` | 不可 | サーバーの中でのカテゴリの順。小さいほど上。作ったときは最大 + 1 |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |
| `deleted_at` | `timestamptz` | 可 | 削除した日時（論理削除）。null なら削除されていない |

### キーと制約
- 主キー：`id`
- 外部キー：`server_id` → `servers.id`
- CHECK：`char_length(name) between 1 and 100`
- インデックス：`(server_id, position)`
- アプリが守る
  - 作成・名前の変更・削除・並べ替えはオーナーだけ
  - 1 つのサーバーに 5 個まで（削除したカテゴリは数えない）
  - 削除すると、中のチャンネルも同じ transaction で論理削除する。既定のチャンネルが入っているカテゴリは削除できない
  - 並び順は `position`、同じなら `created_at` の順

### 関係
- [`servers`](servers.md) 1 : 多 `channel_categories`
- `channel_categories` 1 : 多 [`channels`](channels.md)
