import { parsePort } from "./port";

describe("parsePort", () => {
	it("未設定なら 3001 を返す", () => {
		expect(parsePort(undefined)).toBe(3001);
	});

	it("空文字・空白だけなら 3001 を返す", () => {
		expect(parsePort("")).toBe(3001);
		expect(parsePort("  ")).toBe(3001);
	});

	it("1〜65535 の整数ならその値を返す", () => {
		expect(parsePort("8080")).toBe(8080);
	});

	it("数値でない・範囲外・整数でない値ならエラーにする", () => {
		expect(() => parsePort("abc")).toThrow("PORT が不正です");
		expect(() => parsePort("0")).toThrow("PORT が不正です");
		expect(() => parsePort("65536")).toThrow("PORT が不正です");
		expect(() => parsePort("3001.5")).toThrow("PORT が不正です");
	});
});
