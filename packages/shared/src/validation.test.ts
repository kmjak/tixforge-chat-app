import {
	isPasswordLengthValid,
	isStrongPassword,
	isValidBio,
	normalizeName,
} from "./validation";

describe("isStrongPassword", () => {
	it.each([
		["記号・英小文字・英大文字を含む", "Passw0rd!"],
		["数字が無くても、記号・英小文字・英大文字があればよい", "Password!"],
		["記号は ASCII の記号ならどれでもよい", "Password~"],
	])("%s（%s）なら true", (_, password) => {
		expect(isStrongPassword(password)).toBe(true);
	});

	it.each([
		["記号が無い", "Passw0rdd"],
		["英小文字が無い", "PASSW0RD!"],
		["英大文字が無い", "passw0rd!"],
		["全角の記号は記号に数えない", "Passw0rd！"],
		["空白は記号に数えない", "Passw0rd "],
	])("%s（%s）なら false", (_, password) => {
		expect(isStrongPassword(password)).toBe(false);
	});
});

describe("isPasswordLengthValid", () => {
	it.each([
		[7, false],
		[8, true],
		[128, true],
		[129, false],
	])("%i 文字なら %s", (length, expected) => {
		expect(isPasswordLengthValid("a".repeat(length))).toBe(expected);
	});
});

describe("normalizeName", () => {
	it("前後の空白を除いた値を返す", () => {
		expect(normalizeName("  Taro \n")).toBe("Taro");
	});

	it("32 文字なら受け付ける（絵文字などはコードポイントで 1 文字と数える）", () => {
		expect(normalizeName("あ".repeat(32))).toBe("あ".repeat(32));
		expect(normalizeName("😀".repeat(32))).toBe("😀".repeat(32));
	});

	it.each([
		["空", ""],
		["空白だけ", "   "],
		["33 文字", "あ".repeat(33)],
	])("%s なら null", (_, name) => {
		expect(normalizeName(name)).toBeNull();
	});
});

describe("isValidBio", () => {
	it.each([
		["空", ""],
		["190 文字", "あ".repeat(190)],
		["絵文字 190 文字（コードポイントで数える）", "😀".repeat(190)],
		["前後の空白や改行を含む 190 文字", ` ${"a".repeat(187)}\n `],
	])("%s なら true", (_, bio) => {
		expect(isValidBio(bio)).toBe(true);
	});

	it("191 文字なら false", () => {
		expect(isValidBio("あ".repeat(191))).toBe(false);
	});
});
