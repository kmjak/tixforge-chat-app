# group_dms
## グループ DM

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000018） |
| 目的 | 最大 10 人の会話の部屋。メンバーは全員が対等 |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |
| `name` | `varchar(100)` | 可 | 名前。1〜100 文字（前後の空白を取り除いて数える）。null なら、メンバーの名前を並べて表示する。予定（GT-000019） |
| `last_message_at` | `timestamptz` | 可 | 最後のメッセージの日時。メッセージが 1 通も無ければ null |
| `created_at` | `timestamptz` | 不可 | 作った日時 |
| `updated_at` | `timestamptz` | 不可 | 更新した日時 |

### キーと制約
- 主キー：`id`
- CHECK：`name is null or char_length(name) between 1 and 100`
- アプリが守る
  - 作るときに、作った人を `joined` のメンバーとして、招待したフレンドを `invited` として、同じ transaction で [`group_dm_members`](group_dm_members.md) に加える
  - メッセージを送るたびに、同じ transaction で `last_message_at` を更新する
  - 名前はメンバーなら誰でも変えられる（予定（GT-000019））
  - 全員が抜けた（`joined` のメンバーがいない）グループ DM は、誰も使えない。行は消さない

### 関係
- `group_dms` 1 : 多 [`group_dm_members`](group_dm_members.md)
- `group_dms` 1 : 多 [`messages`](messages.md)
