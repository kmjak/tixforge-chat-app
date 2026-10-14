# `/`
## トップ（LP）

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| 認証が必要か | 不要 |
| 未ログイン時の動き | 表示する |
| ログイン済み時の動き | [`/home`](home.md) へリダイレクトする |
| 権限 | なし |
| パスパラメータ | なし |
| query | なし |
| 遷移可能先 | [`/sign-in`](sign-in.md)・[`/sign-up`](sign-up.md) |
| 呼び出す API | [`GET /api/auth/get-session`](../uri/get-api-auth-get-session.md) |

### 詳細
- サービスの紹介と、サインイン・サインアップへのリンクを置く。
- 今の `/` は server の状態（[`GET /health`](../uri/get-health.md)）を表示しているが、これは開発の初めに置いた仮の画面で、GT-000003 で LP に置き換える。
