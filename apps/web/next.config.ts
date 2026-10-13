import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// workspace のパッケージは TypeScript のまま公開しているので、Next.js に変換させる
	transpilePackages: ["@chat-app/shared"],
};

export default nextConfig;
