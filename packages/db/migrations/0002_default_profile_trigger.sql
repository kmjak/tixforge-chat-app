-- サインアップでアカウント（user）ができたら、デフォルトのプロフィールを 1 つ作る。
-- name は登録時の name（server が前後の空白を除いて 1〜32 文字にしてある）、bio は空。
-- Better Auth のサインアップの transaction の中で動くので、プロフィールが作れなければアカウントもできない
-- （docs/context/schema/profiles.md）。
CREATE FUNCTION create_default_profile() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO "profiles" ("user_id", "name", "is_default")
	VALUES (NEW."id", NEW."name", true);
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "user_create_default_profile"
AFTER INSERT ON "user"
FOR EACH ROW EXECUTE FUNCTION create_default_profile();
