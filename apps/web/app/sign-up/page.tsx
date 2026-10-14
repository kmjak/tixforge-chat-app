import { SignUpForm } from "./sign-up-form";

export default async function SignUp({
	searchParams,
}: {
	searchParams: Promise<{ redirect?: string | string[] }>;
}) {
	const { redirect } = await searchParams;

	return (
		<main>
			<h1>サインアップ</h1>
			<SignUpForm
				redirect={typeof redirect === "string" ? redirect : undefined}
			/>
		</main>
	);
}
