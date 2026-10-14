# `/sign-in`
## サインイン

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| 認証が必要か | 不要 |
| 未ログイン時の動き | 表示する。サインインに成功したら、`redirect` の先（受け付けないとき・無いときは [`/home`](home.md)）へ移る |
| ログイン済み時の動き | [`/home`](home.md) へリダイレクトする |
| 権限 | なし |
| パスパラメータ | なし |
| query | 下の表 |
| 遷移可能先 | [`/home`](home.md)・[`/sign-up`](sign-up.md)・`redirect` の先 |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md)・[`POST /api/auth/sign-in/email`](../uri/post-api-auth-sign-in-email.md) |

### query

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `redirect` | string | いいえ | サインインの後に移るパス。受け付ける値は [routes.md の「保護する画面の共通の動き」](../routes.md#保護する画面の共通の動き)のとおり |

### 詳細
- メールアドレスとパスワードを入力してサインインする。
- 失敗したときは、画面にエラーを表示する（メールアドレスとパスワードのどちらが違うかは区別しない）。
