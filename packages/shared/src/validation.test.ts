import {
	isInviteExpiryHours,
	isPasswordLengthValid,
	isStrongPassword,
	isValidBio,
	normalizeChannelName,
	normalizeName,
	normalizeServerName,
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
		["U+0000 を含む", "a\u0000b"],
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

	it("U+0000 を含むなら false", () => {
		expect(isValidBio("a\u0000b")).toBe(false);
	});
});

describe("normalizeServerName", () => {
	it("前後の空白を除いた値を返す（100 文字まで）", () => {
		expect(normalizeServerName("  My Server ")).toBe("My Server");
		expect(normalizeServerName(` ${"あ".repeat(100)} `)).toBe("あ".repeat(100));
	});

	it.each([
		["空", ""],
		["空白だけ", "   "],
		["101 文字", "あ".repeat(101)],
		["U+0000 を含む", "a\u0000b"],
	])("%s なら null", (_, name) => {
		expect(normalizeServerName(name)).toBeNull();
	});
});

describe("isInviteExpiryHours", () => {
	it.each([[1], [6], [12], [24], [48], [null]])("%p は受け付ける", (value) => {
		expect(isInviteExpiryHours(value)).toBe(true);
	});

	it.each([[0], [2], [72], ["24"], [undefined]])(
		"%p は受け付けない",
		(value) => {
			expect(isInviteExpiryHours(value)).toBe(false);
		},
	);
});

describe("normalizeChannelName", () => {
	it.each([
		[
			"英字・数字・ハイフン・アンダースコア",
			"general_chat-2",
			"general_chat-2",
		],
		[
			"日本語（ひらがな・カタカナ・漢字・長音）",
			"ざつだんルーム雑談",
			"ざつだんルーム雑談",
		],
		["全角数字・漢数字", "第１回十", "第１回十"],
		["アラビア文字", "مرحبا", "مرحبا"],
		["タイ語（母音記号を含む）", "สวัสดี", "สวัสดี"],
		["結合文字の濁点（か＋゛）", "か\u3099", "か\u3099"],
		[
			"1 文字に結合文字 4 個",
			"a\u0301\u0302\u0303\u0323",
			"a\u0301\u0302\u0303\u0323",
		],
		["前後の空白は取り除く", "  一般\n", "一般"],
		["100 文字", "あ".repeat(100), "あ".repeat(100)],
	])("%s は通る", (_, name, expected) => {
		expect(normalizeChannelName(name)).toBe(expected);
	});

	it.each([
		["空", ""],
		["空白だけ", "   "],
		["101 文字", "あ".repeat(101)],
		["中にスペース", "general chat"],
		["中に全角スペース", "雑談\u3000ルーム"],
		["記号", "chat!"],
		["中黒", "雑談・ルーム"],
		["ドット", "a.b"],
		["絵文字", "chat😀"],
		["異体字セレクタ付きの絵文字", "❤\uFE0F"],
		["キーキャップの絵文字（1️⃣）", "1\uFE0F\u20E3"],
		["ZWJ でつないだ絵文字", "👨\u200D👩"],
		["U+0000", "a\u0000b"],
		["先頭が結合文字", "\u3099か"],
		["1 文字に結合文字 5 個", "a\u0301\u0302\u0303\u0323\u0324"],
		["異体字セレクタの補助の範囲", "a\u{E0100}"],
		["CGJ", "a\u034F"],
		["ハングルのフィラーだけ", "\u3164"],
		["半角のハングルのフィラー", "a\uFFA0"],
		["ハングルの初声・中声のフィラー", "\u115F\u1160"],
	])("%s は通らない", (_, name) => {
		expect(normalizeChannelName(name)).toBeNull();
	});
});
