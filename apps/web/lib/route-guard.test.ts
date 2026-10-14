import { decideRoute } from "./route-guard";

const ORIGIN = "http://localhost:3000";

function decide(path: string, loggedIn: boolean) {
	return decideRoute({ url: new URL(path, ORIGIN), loggedIn });
}

describe("未ログインで保護されたページを開くと、サインイン画面に移る", () => {
	it.each([
		["/home", "/sign-in?redirect=%2Fhome"],
		["/servers/a?tab=b", "/sign-in?redirect=%2Fservers%2Fa%3Ftab%3Db"],
		["/not-defined-yet", "/sign-in?redirect=%2Fnot-defined-yet"],
	])("%s → %s", (path, to) => {
		expect(decide(path, false)).toEqual({ type: "redirect", to });
	});
});

describe("decideRoute", () => {
	it.each([["/"], ["/sign-in"], ["/sign-up?redirect=%2Fhome"]])(
		"未ログインでも公開の画面（%s）は表示する",
		(path) => {
			expect(decide(path, false)).toEqual({ type: "next" });
		},
	);

	it("ログイン済みで / を開くと /home へ移る", () => {
		expect(decide("/", true)).toEqual({ type: "redirect", to: "/home" });
	});

	it.each([
		["/sign-in", "/home"],
		["/sign-up", "/home"],
		["/sign-in?redirect=%2Fservers%2Fa%3Ftab%3Db", "/servers/a?tab=b"],
		["/sign-up?redirect=%2F%2Fevil.com", "/home"],
	])("ログイン済みで %s を開くと %s へ移る", (path, to) => {
		expect(decide(path, true)).toEqual({ type: "redirect", to });
	});

	it("ログイン済みなら保護された画面を表示する", () => {
		expect(decide("/home", true)).toEqual({ type: "next" });
	});
});
