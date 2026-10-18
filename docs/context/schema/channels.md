# channels
## チャンネル

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000011） |
| 目的 | サーバーの中の会話の場。サーバーを作ると既定のチャンネル `一般` ができ、参加・退出のメッセージの出し先になる |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `server_id` | `uuid` | 不可 | サーバー（[`servers`](servers.md)`.id`） |
| `category_id` | `uuid` | 可 | 属するカテゴリ（[`channel_categories`](channel_categories.md)`.id`）。null ならカテゴリに属さない。予定（GT-000012） |
| `name` | `varchar(100)` | 不可 | チャンネル名。1〜100 文字。使えるのは文字（あらゆる言語）・数字・ハイフン・アンダースコアだけ。同じサーバーの中で重複してもよい |
| `is_default` | `boolean` | 不可 | 既定のチャンネルか。既定値は false |
| `position` | `integer` | 不可 | 同じ並び（同じカテゴリ、またはカテゴリに属さないもの）の中での順。小さいほど上。作ったときは、その並びの最大 + 1 |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |
| `deleted_at` | `timestamptz` | 可 | 削除した日時（論理削除）。null なら削除されていない |

### キーと制約
- 主キー：`id`
- 外部キー：`server_id` → `servers.id`、`category_id` → `channel_categories.id`
- 一意（部分インデックス）：`server_id`（`is_default = true` の行だけ）。既定のチャンネルはサーバーに 1 つ
- CHECK：`char_length(name) between 1 and 100`
- CHECK：`not (is_default and deleted_at is not null)`（既定のチャンネルは削除できない）
- インデックス：`(server_id, category_id, position)`（GT-000011 では `category_id` の列が無いので `(server_id, position)`。GT-000012 で `category_id` を足すときに変える）
- アプリが守る
  - 名前に使える文字（文字・数字・`-`・`_`）
  - 名前は前後の空白を取り除いてから確かめ、取り除いた値で保存する。「文字」には結合文字（`\p{Mn}`・`\p{Mc}`）を含め、絵文字を作る異体字セレクタ（U+FE00〜FE0F）と囲み記号（`\p{Me}`）は含めない（`packages/shared` の `normalizeChannelName`）
  - 作成・名前の変更・削除はオーナーだけ
  - カテゴリに属さないチャンネルは、1 つのサーバーに 10 個まで。1 つのカテゴリの中も 10 個まで（予定（GT-000012））。削除したチャンネルは数えない（[上限の数の守り方](../schema.md#命名と型の規則)のとおり、`servers` の行をロックしてから数える）
  - 並び順は `position`、同じなら `created_at` の順
  - 削除したチャンネルは、一覧・メッセージの取得と送信の対象から外す
  - 既定のチャンネル `一般`：サーバーの作成と同じ transaction で作る。GT-000011 より前に作られたサーバーには、マイグレーション `0005_default_channels_for_existing_servers` で作った（既定のチャンネルが無いサーバーだけが対象）

### 関係
- [`servers`](servers.md) 1 : 多 `channels`
- [`channel_categories`](channel_categories.md) 1 : 多 `channels`（カテゴリに属さないチャンネルもある）
- `channels` 1 : 多 [`messages`](messages.md)
