# `GET /api/profiles/{profileId}`
## プロフィールの取得

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000008） |
| メソッド | GET |
| 認証が必要か | 必要 |
| 権限 | 自分のプロフィールだけを扱う |
| パスパラメータ | 下の表 |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/profiles/{profileId}`](../routes/profiles-{profileId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `profileId` | string | プロフィールの id（UUID）。自分のプロフィールでない・存在しない・UUID の形でないときは 404 |

### http status
#### 200 プロフィール

`Profile`（[`GET /api/profiles`](get-api-profiles.md) と同じ形）

```json
{ "id": "5d2a9b7c-1e4f-4a8b-b3c2-7e6d5f4a3b21", "name": "ゲーム用", "bio": "", "isDefault": false }
```

#### 404 自分のプロフィールでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。他人のプロフィールでも 403 にはせず 404 にする（その id のプロフィールが存在するかを知らせない）。
