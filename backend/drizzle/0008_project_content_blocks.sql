ALTER TABLE "project_translations" ADD COLUMN IF NOT EXISTS "display_type" text NOT NULL DEFAULT '';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_features" (
  "id" uuid PRIMARY KEY,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "project_features" GROUP BY "project_id", "sort_order" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'project content migration failed: duplicate project_features sort_order';
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "project_features_project_sort_order_uq"
  ON "project_features" ("project_id", "sort_order");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_feature_translations" (
  "feature_id" uuid NOT NULL REFERENCES "project_features"("id") ON DELETE CASCADE,
  "locale" text NOT NULL CHECK ("locale" IN ('ru', 'en')),
  "text" text NOT NULL CHECK (btrim("text") <> ''),
  PRIMARY KEY ("feature_id", "locale")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_notes" (
  "id" uuid PRIMARY KEY,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "project_notes" GROUP BY "project_id", "sort_order" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'project content migration failed: duplicate project_notes sort_order';
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "project_notes_project_sort_order_uq"
  ON "project_notes" ("project_id", "sort_order");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_note_translations" (
  "note_id" uuid NOT NULL REFERENCES "project_notes"("id") ON DELETE CASCADE,
  "locale" text NOT NULL CHECK ("locale" IN ('ru', 'en')),
  "text" text NOT NULL CHECK (btrim("text") <> ''),
  PRIMARY KEY ("note_id", "locale")
);--> statement-breakpoint

DO $$
DECLARE
  fixture_project_count integer;
BEGIN
  SELECT count(*) INTO fixture_project_count FROM "projects" WHERE "external_key" IN (
    'construction-management-control-center', 'project-bradbury', 'foodai'
  );

  IF fixture_project_count NOT IN (0, 3) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: partial CMCC, Project Bradbury, and FoodAI legacy baseline';
  END IF;

  IF fixture_project_count = 3 AND (SELECT count(*) FROM "project_translations" pt JOIN "projects" p ON p."id" = pt."project_id"
      WHERE p."external_key" IN ('construction-management-control-center', 'project-bradbury', 'foodai')
        AND pt."locale" IN ('ru', 'en')) <> 6 THEN
    RAISE EXCEPTION 'project content fixture mapping failed: every expected project must have RU and EN translations';
  END IF;
END $$;--> statement-breakpoint

UPDATE "project_translations" pt
SET "display_type" = fixture."display_type"
FROM "projects" p
JOIN (VALUES
  ('construction-management-control-center', 'en', 'Internal company management system'),
  ('construction-management-control-center', 'ru', 'Внутренняя система управления компанией'),
  ('project-bradbury', 'en', 'Quiet social platform'),
  ('project-bradbury', 'ru', 'Тихая социальная платформа'),
  ('foodai', 'en', 'Grocery intelligence / meal planning product prototype'),
  ('foodai', 'ru', 'Grocery intelligence / meal planning startup product prototype')
) AS fixture("external_key", "locale", "display_type")
  ON fixture."external_key" = p."external_key"
WHERE pt."project_id" = p."id" AND pt."locale" = fixture."locale";--> statement-breakpoint

DO $$
DECLARE
  fixture_project_count integer;
BEGIN
  SELECT count(*) INTO fixture_project_count FROM "projects" WHERE "external_key" IN (
    'construction-management-control-center', 'project-bradbury', 'foodai'
  );

  IF fixture_project_count NOT IN (0, 3) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: partial CMCC, Project Bradbury, and FoodAI legacy baseline';
  END IF;

  IF fixture_project_count = 3 AND EXISTS (
    SELECT 1 FROM "projects" p
    LEFT JOIN "project_translations" pt ON pt."project_id" = p."id" AND pt."locale" IN ('ru', 'en')
    WHERE p."external_key" IN ('construction-management-control-center', 'project-bradbury', 'foodai')
    GROUP BY p."id"
    HAVING count(pt."locale") <> 2 OR count(*) FILTER (WHERE btrim(pt."display_type") <> '') <> 2
  ) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: display_type was not written for both RU and EN translations';
  END IF;
END $$;--> statement-breakpoint

WITH fixture("external_key", "id", "sort_order", "ru", "en") AS (
  VALUES
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000001'::uuid, 10, 'Управление сотрудниками и отделами', 'Employees and departments management'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000002'::uuid, 20, 'Структура компании', 'Company structure'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000003'::uuid, 30, 'Управление строительными объектами', 'Construction objects management'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000004'::uuid, 40, 'Постановка и контроль задач', 'Task creation and control'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000005'::uuid, 50, 'Жизненный цикл задач', 'Task lifecycle'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000006'::uuid, 60, 'Роли и права доступа (RBAC)', 'Role-based access control (RBAC)'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000007'::uuid, 70, 'Файлообмен внутри системы', 'File exchange within the system'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000008'::uuid, 80, 'Интеграция с Mattermost', 'Mattermost integration'),
    ('construction-management-control-center', '81000000-0000-4000-8000-000000000009'::uuid, 90, 'Production deployment (Docker, Nginx, VPS)', 'Production deployment (Docker, Nginx, VPS)'),
    ('project-bradbury', '82000000-0000-4000-8000-000000000001'::uuid, 10, 'Регистрация по invite-коду и размещённая closed alpha', 'Invite-based registration and hosted closed alpha'),
    ('project-bradbury', '82000000-0000-4000-8000-000000000002'::uuid, 20, 'Личное пространство, публичные профили, истории и фотоальбомы', 'Personal space, public profiles, stories and photo shelves'),
    ('project-bradbury', '82000000-0000-4000-8000-000000000003'::uuid, 30, 'Личные сообщения, друзья, подписки и эмоциональные реакции', 'Private messages, friendships, follows and emotional reactions'),
    ('project-bradbury', '82000000-0000-4000-8000-000000000004'::uuid, 40, 'Настройки приватности, жалобы, модерация и admin tools', 'Privacy controls, reporting flows, moderation and admin tools'),
    ('project-bradbury', '82000000-0000-4000-8000-000000000005'::uuid, 50, 'Адаптивный интерфейс для mobile и desktop', 'Responsive mobile and desktop interface'),
    ('foodai', '83000000-0000-4000-8000-000000000001'::uuid, 10, 'Сравнение продуктов и protein-per-dollar логика', 'Product comparison and protein-per-dollar logic'),
    ('foodai', '83000000-0000-4000-8000-000000000002'::uuid, 20, 'Сохранённые сравнения и onboarding-сценарий', 'Saved comparisons and onboarding flow'),
    ('foodai', '83000000-0000-4000-8000-000000000003'::uuid, 30, 'Концепции meal planning и списка покупок', 'Meal planning and grocery list concepts'),
    ('foodai', '83000000-0000-4000-8000-000000000004'::uuid, 40, 'Архитектура на React Native / Expo, Supabase и Zustand', 'React Native / Expo, Supabase, and Zustand architecture'),
    ('foodai', '83000000-0000-4000-8000-000000000005'::uuid, 50, 'FoodAI website / landing page и направление AI/API-интеграций', 'FoodAI website / landing page and AI/API integration direction')
), inserted AS (
  INSERT INTO "project_features" ("id", "project_id", "sort_order")
  SELECT fixture."id", p."id", fixture."sort_order" FROM fixture JOIN "projects" p ON p."external_key" = fixture."external_key"
  RETURNING "id"
)
INSERT INTO "project_feature_translations" ("feature_id", "locale", "text")
SELECT fixture."id", localized."locale", localized."text"
FROM fixture CROSS JOIN LATERAL (VALUES ('ru', fixture."ru"), ('en', fixture."en")) AS localized("locale", "text")
JOIN inserted ON inserted."id" = fixture."id";--> statement-breakpoint

WITH fixture("external_key", "id", "sort_order", "ru", "en") AS (
  VALUES
    ('project-bradbury', '84000000-0000-4000-8000-000000000001'::uuid, 10, 'Проект уже размещён на хостинге prbdbr.com и сейчас находится на этапе закрытого тестирования. Открытая регистрация пока недоступна. Доступ предоставляется только по invite-коду.', 'Hosted at prbdbr.com and currently in closed testing. Open registration is not available yet; access is provided only by invite code.'),
    ('project-bradbury', '84000000-0000-4000-8000-000000000002'::uuid, 20, 'Важно: в некоторых регионах часть контента платформы может корректно подгружаться только при включённом VPN.', 'Please note: in some regions, parts of the platform content may load correctly only when VPN is enabled.')
), inserted AS (
  INSERT INTO "project_notes" ("id", "project_id", "sort_order")
  SELECT fixture."id", p."id", fixture."sort_order" FROM fixture JOIN "projects" p ON p."external_key" = fixture."external_key"
  RETURNING "id"
)
INSERT INTO "project_note_translations" ("note_id", "locale", "text")
SELECT fixture."id", localized."locale", localized."text"
FROM fixture CROSS JOIN LATERAL (VALUES ('ru', fixture."ru"), ('en', fixture."en")) AS localized("locale", "text")
JOIN inserted ON inserted."id" = fixture."id";--> statement-breakpoint

DO $$
DECLARE
  fixture_project_count integer;
BEGIN
  SELECT count(*) INTO fixture_project_count FROM "projects" WHERE "external_key" IN (
    'construction-management-control-center', 'project-bradbury', 'foodai'
  );

  IF fixture_project_count NOT IN (0, 3) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: partial CMCC, Project Bradbury, and FoodAI legacy baseline';
  END IF;

  IF fixture_project_count = 3 AND EXISTS (
    SELECT 1
    FROM (VALUES
      ('construction-management-control-center', 9), ('project-bradbury', 5), ('foodai', 5)
    ) AS expected("external_key", "count")
    JOIN "projects" p ON p."external_key" = expected."external_key"
    LEFT JOIN "project_features" feature ON feature."project_id" = p."id"
    GROUP BY expected."external_key", expected."count"
    HAVING count(feature."id") <> expected."count"
  ) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: feature count does not match the RU/EN fixture mapping';
  END IF;

  IF fixture_project_count = 3 AND ((SELECT count(*) FROM "project_notes" note JOIN "projects" p ON p."id" = note."project_id" WHERE p."external_key" = 'project-bradbury') <> 2
     OR EXISTS (SELECT 1 FROM "project_notes" note JOIN "projects" p ON p."id" = note."project_id" WHERE p."external_key" IN ('construction-management-control-center', 'foodai'))) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: note count does not match the fixture mapping';
  END IF;

  IF fixture_project_count = 3 AND (EXISTS (
    SELECT 1 FROM "project_features" feature
    JOIN "projects" p ON p."id" = feature."project_id"
    LEFT JOIN "project_feature_translations" translation ON translation."feature_id" = feature."id" AND translation."locale" IN ('ru', 'en')
    WHERE p."external_key" IN ('construction-management-control-center', 'project-bradbury', 'foodai')
    GROUP BY feature."id"
    HAVING count(translation."locale") <> 2
  ) OR EXISTS (
    SELECT 1 FROM "project_notes" note
    JOIN "projects" p ON p."id" = note."project_id"
    LEFT JOIN "project_note_translations" translation ON translation."note_id" = note."id" AND translation."locale" IN ('ru', 'en')
    WHERE p."external_key" IN ('construction-management-control-center', 'project-bradbury', 'foodai')
    GROUP BY note."id"
    HAVING count(translation."locale") <> 2
  )) THEN
    RAISE EXCEPTION 'project content fixture mapping failed: every content item must have both RU and EN translations';
  END IF;
END $$;
