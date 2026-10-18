# `/profiles/{profileId}`
## プロフィールの詳細

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000008） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=<開こうとしたパスを URL エンコード>`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する。自分のプロフィールでない・存在しないときは、Next.js の 404 の画面を表示する |
| 権限 | 自分のプロフィールであること |
| パスパラメータ | 下の表 |
| query | なし |
| 遷移可能先 | [`/profiles`](profiles.md) |
| 呼び出す API | [`GET /api/profiles/{profileId}`](../uri/get-api-profiles-{profileId}.md)・[`GET /api/profiles/{profileId}/usages`](../uri/get-api-profiles-{profileId}-usages.md)・[`PATCH /api/profiles/{profileId}`](../uri/patch-api-profiles-{profileId}.md)・[`DELETE /api/profiles/{profileId}`](../uri/delete-api-profiles-{profileId}.md) |

### パスパラメータ

| フィールド | 型 | 説明 |
|------------|----|------|
| `profileId` | string | プロフィールの id（UUID） |

### 詳細
- 名前・自己紹介を編集して保存できる。
- デフォルトでなければ「デフォルトにする」ボタンを置く。
- 使用先（サーバー・フレンド・グループ DM）の一覧を表示する。無ければ「なし」。
- デフォルトでも使用中でもなければ削除できる。削除したら [`/profiles`](profiles.md) へ戻る。デフォルト・使用中のときは、削除できない理由を表示する。
- 操作に失敗したときは、画面にエラーを表示する。
