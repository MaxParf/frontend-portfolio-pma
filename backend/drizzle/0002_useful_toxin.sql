DO $$
BEGIN
	IF (SELECT count(*) FROM "admin_users" WHERE "role" = 'owner') > 1 THEN
		RAISE EXCEPTION 'Cannot migrate admin_users: multiple owner rows exist';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "admin_users" RENAME COLUMN "email" TO "login";--> statement-breakpoint
ALTER TABLE "auth_events" RENAME COLUMN "email_hash" TO "login_hash";--> statement-breakpoint
DROP INDEX "admin_users_email_uq";--> statement-breakpoint
UPDATE "admin_users" SET "login" = '@maxpar.fed', "updated_at" = now() WHERE "role" = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_login_uq" ON "admin_users" USING btree ("login");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_single_owner_uq" ON "admin_users" USING btree ("role") WHERE "admin_users"."role" = 'owner';
