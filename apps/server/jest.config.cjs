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
	},
	// workspace のパッケージ（TypeScript のまま公開）も変換する
	transformIgnorePatterns: ["/node_modules/(?!@chat-app/)"],
};
