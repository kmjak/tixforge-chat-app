"use client";

import {
	isPasswordLengthValid,
	isStrongPassword,
	normalizeName,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
} from "@chat-app/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { authErrorMessage } from "../../lib/auth-errors";
import { resolveRedirect, withRedirect } from "../../lib/redirect";

/** server と同じ規則で先に確かめ、送る前に知らせる（最終的な判定は server が行う） */
function validate(name: string, password: string): string | null {
	if (normalizeName(name) === null) {
		return authErrorMessage("INVALID_NAME");
	}
	if (password.length < PASSWORD_MIN_LENGTH) {
		return authErrorMessage("PASSWORD_TOO_SHORT");
	}
	if (password.length > PASSWORD_MAX_LENGTH) {
		return authErrorMessage("PASSWORD_TOO_LONG");
	}
	if (isPasswordLengthValid(password) && !isStrongPassword(password)) {
		return authErrorMessage("PASSWORD_TOO_WEAK");
	}
	return null;
}

export function SignUpForm({ redirect }: { redirect: string | undefined }) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const name = String(form.get("name"));
		const password = String(form.get("password"));

		const invalid = validate(name, password);
		if (invalid) {
			setError(invalid);
			return;
		}
		setPending(true);
		setError(null);

		const { error } = await authClient.signUp.email({
			name,
			email: String(form.get("email")),
			password,
		});
		if (error) {
			setError(authErrorMessage(error.code));
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
						名前（1〜32 文字）
						<br />
						<input name="name" autoComplete="nickname" required />
					</label>
				</p>
				<p>
					<label>
						メールアドレス
						<br />
						<input name="email" type="email" autoComplete="email" required />
					</label>
				</p>
				<p>
					<label>
						パスワード（8 文字以上。記号・英小文字・英大文字をそれぞれ 1
						文字以上）
						<br />
						<input
							name="password"
							type="password"
							autoComplete="new-password"
							required
						/>
					</label>
				</p>
				{error && <p role="alert">{error}</p>}
				<button type="submit" disabled={pending}>
					サインアップ
				</button>
			</form>
			<p>
				アカウントがある場合は{" "}
				<Link href={withRedirect("/sign-in", redirect)}>サインイン</Link>
			</p>
		</>
	);
}
