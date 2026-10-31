CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"channel_id" uuid,
	"sender_user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_one_room" CHECK (num_nonnulls("messages"."channel_id") = 1),
	CONSTRAINT "messages_kind" CHECK ("messages"."kind" in ('text', 'join', 'leave')),
	CONSTRAINT "messages_body_only_text" CHECK (("messages"."kind" = 'text') = ("messages"."body" is not null)),
	CONSTRAINT "messages_body_length" CHECK ("messages"."body" is null or char_length("messages"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_channel_id_id_idx" ON "messages" USING btree ("channel_id","id" DESC NULLS LAST) WHERE "messages"."channel_id" is not null;