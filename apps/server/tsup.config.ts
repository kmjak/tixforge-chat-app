import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	target: "node24",
	platform: "node",
	clean: true,
	// workspace のパッケージは TypeScript のまま公開しているので、ビルドに同梱する
	noExternal: [/^@chat-app\//],
});
