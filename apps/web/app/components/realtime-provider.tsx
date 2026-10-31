"use client";

import type { WsServerEvent } from "@chat-app/shared";
import { usePathname } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { SERVER_URL } from "../../lib/api";
import {
	checkBrowserSession,
	createRealtimeClient,
	type RealtimeStatus,
	realtimeUrl,
} from "../../lib/realtime";
import { isPublicPath } from "../../lib/route-guard";

type Listener = (event: WsServerEvent) => void;

/** 届いたイベントを受け取る関数を登録する。戻り値で登録を外す（使うのは GT-000014 から） */
const RealtimeContext = createContext<(listener: Listener) => () => void>(
	() => () => {},
);

export function useRealtimeEvents(): (listener: Listener) => () => void {
	return useContext(RealtimeContext);
}

/**
 * ログイン後の画面で、server と WebSocket をつなぎ続ける（docs/context/ws.md）。
 * トップ・サインイン・サインアップでは接続しない。切れて再接続を待っている間だけ、画面の上に知らせを出す
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const connect = !isPublicPath(pathname);
	const [status, setStatus] = useState<RealtimeStatus>("connecting");
	const listeners = useRef(new Set<Listener>());
	const [subscribe] = useState(() => (listener: Listener) => {
		listeners.current.add(listener);
		return () => {
			listeners.current.delete(listener);
		};
	});

	useEffect(() => {
		if (!connect) {
			return;
		}
		const client = createRealtimeClient({
			url: realtimeUrl(SERVER_URL),
			onStatus: setStatus,
			onEvent: (event) => {
				for (const listener of listeners.current) {
					listener(event);
				}
			},
			// サインアウト・セッションの失効：画面全体を読み込み直すと、proxy がサインインの画面へ移す
			onSessionEnded: () => window.location.reload(),
			checkSession: () => checkBrowserSession(SERVER_URL),
		});
		client.start();
		return () => client.stop();
	}, [connect]);

	return (
		<RealtimeContext.Provider value={subscribe}>
			{connect && status === "reconnecting" && (
				<p role="status">接続が切れました。再接続しています…</p>
			)}
			{children}
		</RealtimeContext.Provider>
	);
}
