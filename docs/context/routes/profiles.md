# `/profiles`
## プロフィールの一覧

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000008） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=%2Fprofiles`（[`/sign-in`](sign-in.md)）へリダイレクトする |
| ログイン済み時の動き | 表示する |
| 権限 | ログインしていること（自分のプロフィールだけを表示する） |
| パスパラメータ | なし |
| query | なし |
| 遷移可能先 | [`/home`](home.md)・[`/profiles/{profileId}`](profiles-{profileId}.md) |
| 呼び出す API | [`GET /api/profiles`](../uri/get-api-profiles.md)・[`POST /api/profiles`](../uri/post-api-profiles.md) |

### 詳細
- 自分のプロフィールの一覧（デフォルトが先頭、残りは作った順）と、数（例：2 / 5）を表示する。各プロフィールから詳細へ移る。
- 新しいプロフィールの作成フォーム（名前・自己紹介）を置く。作ると一覧に足される。5 個あるときはフォームを出さず、上限であることを表示する。
- 名前・自己紹介が条件（[`POST /api/profiles`](../uri/post-api-profiles.md)）を満たさないときや、作成に失敗したときは、画面にエラーを表示する。
