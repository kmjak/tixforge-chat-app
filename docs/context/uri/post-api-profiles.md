# `POST /api/profiles`
## プロフィールの作成

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000008） |
| メソッド | POST |
| 認証が必要か | 必要 |
| 権限 | 自分のプロフィールだけを扱う |
| パスパラメータ | なし |
| リクエスト | 下の表（JSON） |
| query | なし |
| 呼び出し元 URL | [`/profiles`](../routes/profiles.md) |

### リクエスト

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `name` | string | はい | 名前。前後の空白を除いて 1〜32 文字。除いた値で保存する。同じアカウントの中で重複してもよい |
| `bio` | string | いいえ | 自己紹介。0〜190 文字（入力のまま保存する）。省略すると空文字 |

```json
{ "name": "ゲーム用", "bio": "" }
```

作るプロフィールはデフォルトにならない（デフォルトへの切り替えは [`PATCH /api/profiles/{profileId}`](patch-api-profiles-{profileId}.md)）。

### http status
#### 201 作った

`Profile`（[`GET /api/profiles`](get-api-profiles.md) と同じ形）

```json
{ "id": "5d2a9b7c-1e4f-4a8b-b3c2-7e6d5f4a3b21", "name": "ゲーム用", "bio": "", "isDefault": false }
```

#### 400 入力が正しくない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：

| code | 起きるとき |
|------|-----------|
| `INVALID_NAME` | `name` が文字列でない、または前後の空白を除いて 1〜32 文字でない |
| `INVALID_BIO` | `bio` が文字列でない、または 190 文字より長い |
| `BAD_REQUEST` | 本文が JSON のオブジェクトでない |

#### 409 プロフィールの数が上限
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`PROFILE_LIMIT_REACHED`（1 つのアカウントのプロフィールは、デフォルトを含めて 5 個まで）
