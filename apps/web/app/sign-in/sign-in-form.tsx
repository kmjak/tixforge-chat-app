"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { authErrorMessage, DEFAULT_ERROR_MESSAGE } from "../../lib/auth-errors";
import { resolveRedirect, withRedirect } from "../../lib/redirect";

export function SignInForm({ redirect }: { redirect: string | undefined }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setPending(true);
		setError(null);

		try {
			const { error } = await authClient.signIn.email({
				email: String(form.get("email")),
				password: String(form.get("password")),
			});
			if (error) {
				setError(authErrorMessage(error.code));
				setPending(false);
				return;
			}
		} catch {
			// server に届かないなど、応答が無いとき
			setError(DEFAULT_ERROR_MESSAGE);
			setPending(false);
			return;
		}
		router.replace(resolveRedirect(redirect, window.location.origin));
		router.refresh();
	}

	return (
		<>
			<form onSubmit={handleSubmit}>
				<p>
					<label>
						メールアドレス
						<br />
						<input name="email" type="email" autoComplete="email" required />
					</label>
				</p>
				<p>
					<label>
						パスワード
						<br />
						<input
							name="password"
							type="password"
							autoComplete="current-password"
							required
						/>
					</label>
				</p>
				{error && <p role="alert">{error}</p>}
				<button type="submit" disabled={pending}>
					サインイン
				</button>
			</form>
			<p>
				アカウントが無い場合は{" "}
				<Link href={withRedirect("/sign-up", redirect)}>サインアップ</Link>
			</p>
		</>
	);
}
