import { DEFAULT_ERROR_MESSAGE, errorMessage } from "./error-messages";

describe("errorMessage", () => {
	it("知っている code なら、その code のメッセージを返す", () => {
		expect(errorMessage("PASSWORD_TOO_WEAK")).toBe(
			"パスワードには、記号・英小文字・英大文字をそれぞれ 1 文字以上含めてください。",
		);
	});

	it.each([
		["code が無い（429 など）", undefined],
		["知らない code", "SOMETHING_NEW"],
		["Object のプロパティ名", "toString"],
	])("%s なら共通のメッセージを返す", (_, code) => {
		expect(errorMessage(code)).toBe(DEFAULT_ERROR_MESSAGE);
	});
});
