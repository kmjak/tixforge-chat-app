"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { authErrorMessage } from "../../lib/auth-errors";

export function SignOutButton() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);

	async function handleClick() {
		setError(null);
		const { error } = await authClient.signOut();
		if (error) {
			setError(authErrorMessage(error.code));
			return;
		}
		router.replace("/");
		router.refresh();
	}

	return (
		<>
			<button type="button" onClick={handleClick}>
				サインアウト
			</button>
			{error && <p role="alert">{error}</p>}
		</>
	);
}
