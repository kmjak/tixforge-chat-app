# `/sign-up`
## サインアップ

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| 認証が必要か | 不要 |
| 未ログイン時の動き | 表示する。サインアップに成功したら、そのままログインした状態で [`/home`](home.md) へ移る |
| ログイン済み時の動き | [`/home`](home.md) へリダイレクトする |
| 権限 | なし |
| パスパラメータ | なし |
| query | なし |
| 遷移可能先 | [`/home`](home.md)・[`/sign-in`](sign-in.md) |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md)・[`POST /api/auth/sign-up/email`](../uri/post-api-auth-sign-up-email.md) |

### 詳細
- 名前・メールアドレス・パスワードを入力してアカウントを作る。
- 失敗したとき（メールアドレスが登録済み・パスワードが条件を満たさない など）は、画面にエラーを表示する。
