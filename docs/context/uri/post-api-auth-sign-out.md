# `POST /api/auth/sign-out`
## サインアウト

| 項目 | 内容 |
|------|------|
| 状態 | 予定（GT-000003） |
| メソッド | POST |
| 認証が必要か | 必要（セッションの cookie） |
| 権限 | なし |
| パスパラメータ | なし |
| リクエスト | なし |
| query | なし |
| 呼び出し元 URL | [`/home`](../routes/home.md) |

今のセッションを消し、セッションの cookie を消す。Better Auth が提供する。

### http status
#### 200 サインアウトした

| フィールド | 型 | 必須 | 説明 |
|------------|----|------|------|
| `success` | boolean | はい | 常に `true` |

```json
{ "success": true }
```

#### 400 セッションの cookie が無い
[エラーの共通形式](../uri.md#エラーの共通形式)。`code`：`FAILED_TO_GET_SESSION`

```json
{ "code": "FAILED_TO_GET_SESSION", "message": "Failed to get session" }
```
