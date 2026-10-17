# `/home`
## ログイン後の画面

| 項目 | 内容 |
|------|------|
| 状態 | 実装済み（GT-000003） |
| 認証が必要か | 必要 |
| 未ログイン時の動き | `/sign-in?redirect=%2Fhome`（[`/sign-in`](sign-in.md)。`/home` を URL エンコードして渡す）へリダイレクトする |
| ログイン済み時の動き | 表示する。サインアウトしたら [`/`](root.md) へ移る |
| 権限 | ログインしていること（ほかの条件はなし） |
| パスパラメータ | なし |
| query | なし |
| 遷移可能先 | [`/`](root.md) |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md)・[`POST /api/auth/sign-out`](../uri/post-api-auth-sign-out.md) |

### 詳細
- サインインとサインアップの後に最初に開く画面。
- GT-000003 ではサインアウトのボタンだけを置く。フレンド・サーバーなどの中身は、それぞれのチケットで足す。
