# データモデル（schema）

DB（Neon の Postgres）のテーブルの一覧と、テーブルにまたがる規則。テーブルごとの詳細は `schema/` に 1 テーブル 1 ファイルで置く。画面と API のパスは [routes.md](routes.md)・[uri.md](uri.md) にある。

## ER 図
関係とキーだけを書く。列の詳細は各テーブルのファイルにある。

```mermaid
erDiagram
    user ||--o{ session : "ログイン"
    user ||--o{ account : "パスワード"
    user ||--o{ profiles : "持つ"
    user ||--o{ servers : "オーナー"
    servers ||--o{ server_members : ""
    user ||--o{ server_members : ""
    profiles |o--o{ server_members : "割り当て"
    servers ||--o{ server_invites : ""
    user ||--o{ server_invites : "作った人"
    servers ||--o{ channel_categories : ""
    servers ||--o{ channels : ""
    channel_categories |o--o{ channels : "まとめる"
    user ||--o{ friend_requests : "送る・受ける"
    profiles ||--o{ friend_requests : "申請者のプロフィール"
    servers ||--o{ friend_requests : "申請した場"
    user ||--o{ friendships : "両側"
    profiles ||--o{ friendships : "割り当て"
    user ||--o{ friend_links : ""
    profiles ||--o{ friend_links : "見せるプロフィール"
    user ||--o{ dms : "2 人"
    group_dms ||--o{ group_dm_members : ""
    user ||--o{ group_dm_members : ""
    profiles |o--o{ group_dm_members : "割り当て"
    channels |o--o{ messages : ""
    dms |o--o{ messages : ""
    group_dms |o--o{ messages : ""
    user ||--o{ messages : "送り手"

    user {
        uuid id PK
    }
    session {
        uuid id PK
        uuid user_id FK
    }
    account {
        uuid id PK
        uuid user_id FK
    }
    verification {
        uuid id PK
    }
    profiles {
        uuid id PK
        uuid user_id FK
    }
    servers {
        uuid id PK
        uuid owner_user_id FK
    }
    server_members {
        uuid server_id PK, FK
        uuid user_id PK, FK
        uuid profile_id FK
    }
    server_invites {
        uuid id PK
        text token UK
        uuid server_id FK
        uuid created_by_user_id FK
    }
    channel_categories {
        uuid id PK
        uuid server_id FK
    }
    channels {
        uuid id PK
        uuid server_id FK
        uuid category_id FK
    }
    friend_requests {
        uuid id PK
        uuid from_user_id FK
        uuid to_user_id FK
        uuid from_profile_id FK
        uuid server_id FK
    }
    friendships {
        uuid user_id PK, FK
        uuid friend_user_id PK, FK
        uuid profile_id FK
    }
    friend_links {
        uuid id PK
        text token UK
        uuid user_id FK
        uuid profile_id FK
    }
    dms {
        uuid id PK
        uuid user_a_id FK
        uuid user_b_id FK
    }
    group_dms {
        uuid id PK
    }
    group_dm_members {
        uuid group_dm_id PK, FK
        uuid user_id PK, FK
        uuid profile_id FK
        uuid invited_by_user_id FK
    }
    messages {
        bigint id PK
        uuid channel_id FK
        uuid dm_id FK
        uuid group_dm_id FK
        uuid sender_user_id FK
    }
```

## テーブルの一覧
| テーブル | 内容 | 状態 |
|----------|------|------|
| [`user`](schema/user.md) | アカウント（Better Auth） | 実装済み（GT-000003） |
| [`session`](schema/session.md) | ログインのセッション（Better Auth） | 実装済み（GT-000003） |
| [`account`](schema/account.md) | ログインの方法とパスワード（Better Auth） | 実装済み（GT-000003） |
| [`verification`](schema/verification.md) | 確認用のトークン（Better Auth。MVP では使わない） | 実装済み（GT-000003） |
| [`profiles`](schema/profiles.md) | プロフィール | 実装済み（GT-000003） |
| [`servers`](schema/servers.md) | サーバー | 実装済み（GT-000009） |
| [`server_members`](schema/server_members.md) | サーバーのメンバーと、サーバーで使うプロフィール | 実装済み（GT-000009） |
| [`server_invites`](schema/server_invites.md) | サーバーの招待リンク | 実装済み（GT-000009） |
| [`channels`](schema/channels.md) | チャンネル | 実装済み（GT-000011） |
| [`channel_categories`](schema/channel_categories.md) | チャンネルのカテゴリ | 予定（GT-000012） |
| [`friend_requests`](schema/friend_requests.md) | フレンド申請 | 予定（GT-000015） |
| [`friendships`](schema/friendships.md) | フレンドと、相手に見せるプロフィール | 予定（GT-000015） |
| [`friend_links`](schema/friend_links.md) | フレンドリンク | 予定（GT-000016） |
| [`dms`](schema/dms.md) | DM | 予定（GT-000017） |
| [`group_dms`](schema/group_dms.md) | グループ DM | 予定（GT-000018） |
| [`group_dm_members`](schema/group_dm_members.md) | グループ DM の招待・メンバーと、グループ DM で使うプロフィール | 予定（GT-000018） |
| [`messages`](schema/messages.md) | メッセージ（チャンネル・DM・グループ DM） | 予定（GT-000014） |

## ドメイン概念とテーブル
[overview.md](overview.md) の概念が、どのテーブルで表されるか。

| 概念 | テーブル |
|------|----------|
| アカウント | `user`（ログインは `session`・`account`） |
| プロフィール | `profiles`（デフォルトは `is_default`） |
| サーバー | `servers`（オーナーは `owner_user_id`） |
| サーバーのメンバー | `server_members` |
| 招待リンク | `server_invites` |
| チャンネル・カテゴリ | `channels`（既定のチャンネルは `is_default`）・`channel_categories` |
| フレンド申請 | `friend_requests` |
| フレンド | `friendships`（1 組を向きごとに 2 行） |
| フレンドリンク | `friend_links` |
| DM | `dms` |
| グループ DM | `group_dms`・`group_dm_members` |
| メッセージ | `messages` |
| 相手ごとのプロフィールの割り当て | 専用のテーブルは無い。使う場所ごとの列で表す（下の「プロフィールの割り当て」） |

## プロフィールの割り当て
「その場で、相手にどのプロフィールを見せるか」は、次の 3 つの列で表す。

| その場 | 列 | 備考 |
|--------|----|------|
| サーバー | `server_members.profile_id` | そのサーバーのメンバー全員に見せる |
| フレンド・DM | `friendships.profile_id` | その相手だけに見せる。DM もこれを使う |
| グループ DM | `group_dm_members.profile_id` | そのグループ DM のメンバー全員に見せる |

- **フレンドが優先**：見る人が相手のフレンドなら、サーバー・グループ DM の中でも、相手が見る人に割り当てたプロフィール（`friendships` の 相手 → 見る人 の行）で表示する。メンバーの一覧・メッセージの送り手も同じ。フレンドどうしなら、相手がそのサーバー・グループ DM にいると分かってもよい、という方針による。そのため、同じ発言でも見る人によって送り手の名前が変わる。
- プロフィールが「使用中」とは、上のどれかで割り当てられていること。サーバーは `left_at` が null の行、グループ DM は `status = 'joined'` の行だけを数える（退出した行の `profile_id` は「直前のプロフィール」で、使用中ではない）。
- プロフィールの使用先の一覧は、この 3 つを合わせたもの。新しく割り当ての場を作るチケットは、この表に足し、`packages/db/src/profiles.ts` の `PROFILE_USAGE_SOURCES` に、その場の使用先を返す処理（`ProfileUsageSource`）を足す（使用先の一覧と、削除のときの「使用中か」の判定に使われる。GT-000008）。
- **割り当てる処理**（参加・フレンドになる・グループ DM の承認・割り当ての変更）は、transaction の最初に、割り当てるプロフィールの持ち主の `user` の行を `SELECT … FOR UPDATE` でロックする。プロフィールの削除も同じ行をロックしてから「使用中か」を確かめるので、割り当てと削除が同時に起きても、使用中のプロフィールが消えない。

## 命名と型の規則
- テーブル名・列名は snake_case。自前のテーブルは複数形にする。Better Auth のテーブルは Better Auth の名前のまま（`user`・`session`・`account`・`verification`）。
- API の応答では camelCase に変える（`created_at` → `createdAt`）。
- 型は Postgres の型で書く（`uuid`・`varchar(n)`・`text`・`boolean`・`integer`・`bigint`・`timestamptz`）。
- 日時はすべて `timestamptz`。`created_at` は既定値 `now()`。
- 外部キーの列は `<参照先の単数形>_id`（例：`server_id`）。同じテーブルを 2 つ参照するときは役割を付ける（例：`from_user_id`・`to_user_id`）。
- 論理削除は `deleted_at`（null なら削除されていない）。論理削除した行は、一覧・取得・上限の数の対象から外す。
- **上限の数をアプリで守るとき**（プロフィールは 5 個まで、など）は、同じ transaction の中で、先に親の行（`user`・`servers`・`group_dms` など）を `SELECT … FOR UPDATE` でロックしてから数え、挿入する。Postgres の既定（READ COMMITTED）では、ロックせずに数えると、同時に作られたときに上限を超えるため。
- **オーナーだけができる操作**（チャンネルの作成・名前の変更・削除など）は、transaction の最初に `servers` の行を `SELECT … FOR UPDATE` でロックしてから、`owner_user_id` で確かめる。オーナーの譲渡（GT-000010）も同じ行をロックしてから書き換えるので、譲渡の直後に元のオーナーの操作が通ることがない。
- **2 人の関係を作る処理**（フレンド申請の承認・フレンドリンク）は、transaction の最初に、2 人の `user` の行を id の小さい順に `SELECT … FOR UPDATE` でロックする。同じ 2 人の処理が順番に並ぶので、行を入れる順番の違いによるデッドロックと、フレンドの重複が起きない。

## id の規則
- URL や API の応答に出る id（アカウント・プロフィール・サーバー・チャンネル・DM・グループ DM）は UUID。アカウントの id は、Better Auth の id の生成を UUID にする設定で作る。
- メッセージの id は `bigint` の連番（ページ単位の取得で境目に使うため）。連番は推測しやすいので、下の「参加者の確認」を必ず行う。
- 招待リンク・フレンドリンクは、id とは別の推測できないランダムなトークン（`token`。暗号論的な乱数で 32 バイト以上を base64url にしたもの）を URL に使う。id は URL に出さない。

## 相手に見せてよいもの・見せてはいけないもの
- **ほかのアカウントに見せない**
  - アカウントの id（`user.id`）・メールアドレス・`user.name`
  - セッション・パスワード（`session`・`account`）
  - その人のほかのプロフィール、2 つのプロフィールが同じ人のものであること
- **ほかのアカウントに見せてよい**：見る人に割り当てられたプロフィール（`profiles` の `id`・`name`・`bio`）だけ。見る人がフレンドなら、どこでも相手の `friendships` の行（相手 → 見る人）のプロフィール。フレンドでなければ、その場（サーバー・グループ DM）の割り当て（上の「プロフィールの割り当て」）。
- **退出した人**：フレンドでない人には、`left_display_name`（退出したときのプロフィールの名前）と「退出済み」であることだけを見せる。フレンドには、フレンドの割り当てのプロフィールに「退出済み」を付けて見せる。
- **ほかの人を API で指すとき**は、アカウントの id ではなく、見る人に見せたプロフィールの id を使う（例：オーナーの譲渡の相手）。server は、見せたときと同じ規則（フレンドの割り当て → その場の割り当て）でアカウントを引き、引いたアカウントがその場の今のメンバー（サーバーは `left_at` が null、グループ DM は `status = 'joined'`）かを必ず確かめる。違えば 404 にする（フレンドの割り当てだけで引くと、その場にいないフレンドを指せてしまうため）。
- **アカウント単位の判定の結果**（同じ 2 人の間に承認待ちの申請が既にある、など）を、フレンドでない相手に区別できる形で返さない。別のプロフィールが同じ人だと分かってしまうため。例：フレンド申請は場（サーバー）ごとの別の行にし、同じ 2 人の間に別の場の申請があるかどうかで応答を変えない（[`friend_requests`](schema/friend_requests.md)）。フレンドどうしの間では区別してよい（例：既にフレンドの相手のフレンドリンクは「既にフレンド」と返す）。
- **トークン**（招待リンク・フレンドリンク）は、作った人と、リンクを受け取った人だけが知る。一覧などの応答には、作った本人の分だけを含める。
- 自分自身には、自分のアカウントの情報（`GET /api/me` など）と、自分のすべてのプロフィールを見せてよい。

## 参加者の確認
メッセージと部屋の情報（メンバー・名前など）を取得・送信するときは、必ず次を確かめる。メッセージの id や部屋の id が分かっても、参加者でなければ 404 にする（存在するかどうかも分からないようにする）。

| 部屋 | 確かめること |
|------|--------------|
| チャンネル | チャンネルが削除されていない（`channels.deleted_at` が null）。サーバーが削除されていない。呼び出した人がそのサーバーのメンバー（`server_members.left_at` が null） |
| DM | 呼び出した人が `dms.user_a_id` か `dms.user_b_id` |
| グループ DM | 呼び出した人が `group_dm_members` で `status = 'joined'` |

## ファイル名の規則
詳細のファイル名はテーブル名そのまま（`schema/<テーブル名>.md`）。テーブル名からファイルを探せるようにするため。

## 追記の決まり
**新しいテーブルや列を作るチケットは、このファイル（ER 図・一覧・必要なら各規則）と `schema/` の詳細のファイルを追加・更新する。** テーブルや列を実装・廃止したチケットは、詳細のファイルの「状態」を更新する。

詳細のファイルは次の形で書く。

```markdown
# <テーブル名>
## <内容>

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000000） |
| 目的 | … |

### 列
| 列名 | 型 | null | 説明 |
|------|----|------|------|
| `id` | `uuid` | 不可 | 主キー |

### キーと制約
- 主キー：…

### 関係
- …
```

- 後のチケットで足す列は、列の説明に `予定（GT-000000）` と書く（テーブルの状態とずれるときだけ）。
- アプリが確かめる規則（上限の数など）も「キーと制約」に書き、DB で守るのか、アプリで守るのかを分ける。

## 状態の書き方
- `予定（<チケット id>）`：そのチケットで作る
- `実装済み（<チケット id>）`：そのチケットで作った
- `廃止予定（<チケット id>）`：そのチケットで消す
