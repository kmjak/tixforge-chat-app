import { SignInForm } from "./sign-in-form";

export default async function SignIn({
	searchParams,
}: {
	searchParams: Promise<{ redirect?: string | string[] }>;
}) {
	const { redirect } = await searchParams;

	return (
		<main>
			<h1>サインイン</h1>
			<SignInForm
				redirect={typeof redirect === "string" ? redirect : undefined}
			/>
		</main>
	);
}
