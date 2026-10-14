# `/sign-up`
## サインアップ

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| 認証が必要か | 不要 |
| 未ログイン時の動き | 表示する。サインアップに成功したら、そのままログインした状態で `redirect` の先（受け付けないとき・無いときは [`/home`](home.md)）へ移る |
| ログイン済み時の動き | [`/home`](home.md) へリダイレクトする |
| 権限 | なし |
| パスパラメータ | なし |
| query | 下の表 |
| 遷移可能先 | [`/home`](home.md)・[`/sign-in`](sign-in.md)・`redirect` の先 |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md)・[`POST /api/auth/sign-up/email`](../uri/post-api-auth-sign-up-email.md) |

### query

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `redirect` | string | いいえ | サインアップの後に移るパス。受け付ける値は [routes.md の「保護する画面の共通の動き」](../routes.md#保護する画面の共通の動き)のとおり |

### 詳細
- 名前・メールアドレス・パスワードを入力してアカウントを作る。
- 失敗したとき（メールアドレスが登録済み・パスワードが条件を満たさない など）は、画面にエラーを表示する。
- `/sign-in` へのリンクには、受け取った `redirect` を引き継ぐ。
