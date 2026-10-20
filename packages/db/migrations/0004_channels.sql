CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "channels_name_length" CHECK (char_length("channels"."name") between 1 and 100),
	CONSTRAINT "channels_default_not_deleted" CHECK (not ("channels"."is_default" and "channels"."deleted_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_server_id_position_idx" ON "channels" USING btree ("server_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_server_id_default_idx" ON "channels" USING btree ("server_id") WHERE "channels"."is_default" = true;