import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RealtimeProvider } from "./components/realtime-provider";

export const metadata: Metadata = {
	title: "chat-app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ja">
			<body>
				<RealtimeProvider>{children}</RealtimeProvider>
			</body>
		</html>
	);
}
