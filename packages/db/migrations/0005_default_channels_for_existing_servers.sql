-- GT-000011 より前に作られたサーバー（既定のチャンネルが無いもの）に、既定のチャンネル「一般」を作る。
-- これより後に作るサーバーは、作成と同じ transaction で「一般」を作る（packages/db/src/servers.ts）。
-- 既定のチャンネルが無いサーバーだけを対象にするので、何度流しても重複しない（docs/context/schema/channels.md）。
INSERT INTO "channels" ("server_id", "name", "is_default", "position")
SELECT "servers"."id", '一般', true, 1
FROM "servers"
WHERE NOT EXISTS (
	SELECT 1 FROM "channels"
	WHERE "channels"."server_id" = "servers"."id" AND "channels"."is_default" = true
);
