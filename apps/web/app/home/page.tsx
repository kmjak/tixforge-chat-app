import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export default function Home() {
	return (
		<main>
			<h1>ホーム</h1>
			<p>
				<Link href="/profiles">プロフィール</Link>
			</p>
			<SignOutButton />
		</main>
	);
}
