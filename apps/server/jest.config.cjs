// better-auth などの ESM だけのパッケージも CommonJS に変換して読み込む。
// テスト用の DB（PGlite）は中で動的 import を使うので、package.json の test で
// NODE_OPTIONS=--experimental-vm-modules を付けて動かす
/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	// watchman が動いていない環境でも動くように、ファイルの検索に watchman を使わない
	watchman: false,
	roots: ["<rootDir>/src"],
	transform: {
		"^.+\\.ts$": [
			"@swc/jest",
			{
				jsc: { parser: { syntax: "typescript" }, target: "es2023" },
				module: { type: "commonjs" },
			},
		],
		"^.+\\.m?js$": [
			"@swc/jest",
			{
				jsc: { parser: { syntax: "ecmascript" }, target: "es2023" },
				module: { type: "commonjs" },
			},
		],
	},
	// workspace のパッケージ（TypeScript のまま公開）と、node_modules の ESM（.mjs と
	// "type": "module" のパッケージ）を変換する。pnpm の .pnpm の下にあるので、node_modules は全体を対象にする
	transformIgnorePatterns: [],
};
