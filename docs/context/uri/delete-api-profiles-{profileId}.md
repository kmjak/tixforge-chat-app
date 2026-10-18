# `DELETE /api/profiles/{profileId}`
## プロフィールの削除

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000008） |
| メソッド | DELETE |
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

物理削除する（[schema の `profiles`](../schema/profiles.md)）。

### http status
#### 204 削除した
本文なし。

#### 404 自分のプロフィールでない・存在しない
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`NOT_FOUND`。他人のプロフィールでも 403 にはせず 404 にする（その id のプロフィールが存在するかを知らせない）。

#### 409 削除できないプロフィール
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：

| code | 起きるとき |
|------|-----------|
| `PROFILE_IS_DEFAULT` | デフォルトのプロフィール（先に別のプロフィールをデフォルトにする） |
| `PROFILE_IN_USE` | 使用中（サーバー・フレンド・グループ DM に割り当て済み。[`GET /api/profiles/{profileId}/usages`](get-api-profiles-{profileId}-usages.md)） |
