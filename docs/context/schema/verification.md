# verification
## 確認用のトークン（Better Auth）

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| 目的 | メールアドレスの確認・パスワードの再設定などに使うトークン。Better Auth が必ず作るテーブルだが、MVP ではこれらの機能を使わない（MVP の対象外）ので、行は作られない |

Better Auth のテーブル。列は Better Auth が決める（主な列だけを書く）。

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `identifier` | `text` | 不可 | 何の確認か（メールアドレスなど） |
| `value` | `text` | 不可 | トークン |
| `expires_at` | `timestamptz` | 不可 | 期限 |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- インデックス：`identifier`

### 関係
- ほかのテーブルと外部キーで結ばない
