import Link from "next/link";

export default function Top() {
	return (
		<main>
			<h1>chat-app</h1>
			<p>
				仕事・友人・ゲーム・推し活など、場面ごとに使い分けていたチャットを 1
				つのアカウントで。
			</p>
			<p>
				プロフィールを複数作り、サーバーや友人ごとにどのプロフィールを見せるかを選べます。
			</p>
			<ul>
				<li>
					<Link href="/sign-in">サインイン</Link>
				</li>
				<li>
					<Link href="/sign-up">サインアップ</Link>
				</li>
			</ul>
		</main>
	);
}
