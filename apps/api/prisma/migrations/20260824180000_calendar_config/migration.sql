-- Settings that belong to a way of dividing time, and to no other.
--
-- The first day of the week is the case that forced this. It is not a preference
-- of a person: a week only exists inside the Gregorian calendar. The naŭ calendar
-- has nine-day naŭ that do not align to a weekday and cannot be asked the
-- question at all, and astrological transits have no weeks in any sense. Hanging
-- it off the user would give every ordering system a setting most of them must
-- then ignore.
--
-- The built-in Gregorian row is shared by every workspace, so a workspace that
-- wants Sunday gets its own row of the same kind, which overrides the built-in.
-- That is exactly what `workspaceId` being nullable was already for.
ALTER TABLE "Calendar" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';

-- ISO Monday is what every existing calculation already assumes, in
-- periodBounds, in the client, and in the weekly cron. Writing it down makes the
-- assumption visible instead of leaving it implicit in three places.
UPDATE "Calendar"
SET "config" = jsonb_build_object('firstDayOfWeek', 1)
WHERE "kind" = 'GREGORIAN' AND "config" = '{}'::jsonb;
