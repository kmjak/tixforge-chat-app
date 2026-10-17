import { resolveRedirect, withRedirect } from "./redirect";

const ORIGIN = "http://localhost:3000";

describe("resolveRedirect", () => {
	it.each([["/home"], ["/servers/a?tab=b"], ["/friends#top"]])(
		"アプリの中のパス（%s）はそのまま返す",
		(redirect) => {
			expect(resolveRedirect(redirect, ORIGIN)).toBe(redirect);
		},
	);

	it.each([
		["無い", undefined],
		["null", null],
		["空", ""],
		["/ で始まらない", "home"],
		["外部の URL", "https://evil.com"],
		["// で始まる", "//evil.com"],
		["\\ を含む", "/\\evil.com"],
		["タブを含む", "/\t/evil.com"],
		["改行を含む", "/\n/evil.com"],
		["空白を含む", "/ /evil.com"],
	])("%s なら /home を返す", (_, redirect) => {
		expect(resolveRedirect(redirect, ORIGIN)).toBe("/home");
	});
});

describe("withRedirect", () => {
	it("redirect を URL エンコードして付ける", () => {
		expect(withRedirect("/sign-up", "/servers/a?tab=b")).toBe(
			"/sign-up?redirect=%2Fservers%2Fa%3Ftab%3Db",
		);
	});

	it("redirect が無ければ付けない", () => {
		expect(withRedirect("/sign-in", undefined)).toBe("/sign-in");
		expect(withRedirect("/sign-in", "")).toBe("/sign-in");
	});
});
