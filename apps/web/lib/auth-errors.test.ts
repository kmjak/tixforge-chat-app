import { authErrorMessage, DEFAULT_ERROR_MESSAGE } from "./auth-errors";

describe("authErrorMessage", () => {
	it("知っている code なら、その code のメッセージを返す", () => {
		expect(authErrorMessage("PASSWORD_TOO_WEAK")).toBe(
			"パスワードには、記号・英小文字・英大文字をそれぞれ 1 文字以上含めてください。",
		);
	});

	it.each([
		["code が無い（429 など）", undefined],
		["知らない code", "SOMETHING_NEW"],
		["Object のプロパティ名", "toString"],
	])("%s なら共通のメッセージを返す", (_, code) => {
		expect(authErrorMessage(code)).toBe(DEFAULT_ERROR_MESSAGE);
	});
});
