import { DEFAULT_ERROR_MESSAGE, errorMessage } from "./error-messages";

describe("errorMessage", () => {
	it("知っている code なら、その code のメッセージを返す", () => {
		expect(errorMessage("PASSWORD_TOO_WEAK")).toBe(
			"パスワードには、記号・英小文字・英大文字をそれぞれ 1 文字以上含めてください。",
		);
	});

	it.each([
		["INVALID_BIO", "自己紹介は 190 文字以内で入力してください。"],
		["PROFILE_LIMIT_REACHED", "プロフィールは 5 個まで作れます。"],
		["PROFILE_IS_DEFAULT", "デフォルトのプロフィールは削除できません。"],
		["PROFILE_IN_USE", "使用中のプロフィールは削除できません。"],
		["NOT_FOUND", "見つかりませんでした。ページを読み込み直してください。"],
		["INVALID_SERVER_NAME", "サーバー名は 1〜100 文字で入力してください。"],
		["INVITE_EXPIRED", "この招待リンクは有効期限が切れています。"],
		[
			"CHANNEL_LIMIT_REACHED",
			"1 つのカテゴリ、またはカテゴリに属さないチャンネルは 10 個までです。",
		],
		["CHANNEL_IS_DEFAULT", "既定のチャンネルは削除できません。"],
		["CATEGORY_LIMIT_REACHED", "カテゴリは 5 個まで作れます。"],
		[
			"CATEGORY_HAS_DEFAULT_CHANNEL",
			"既定のチャンネルが入っているカテゴリは削除できません。先に既定のチャンネルをほかの並びへ移してください。",
		],
		[
			"LAYOUT_OUTDATED",
			"ほかの画面でチャンネルやカテゴリが変わりました。読み込み直したので、もう一度並べ替えてください。",
		],
	])(
		"プロフィール・サーバー・チャンネル・カテゴリの API の code（%s）のメッセージを返す",
		(code, message) => {
			expect(errorMessage(code)).toBe(message);
		},
	);

	it.each([
		["code が無い（429 など）", undefined],
		["知らない code", "SOMETHING_NEW"],
		["Object のプロパティ名", "toString"],
	])("%s なら共通のメッセージを返す", (_, code) => {
		expect(errorMessage(code)).toBe(DEFAULT_ERROR_MESSAGE);
	});
});
