-- RFC 5545 can only describe one kind of recurrence.
--
-- An RRULE is a pure function of DTSTART, which is what lets a calendar answer
-- for 2030 without knowing what anyone did. That is correct for "write in the
-- journal every day": missing today does not make tomorrow count double.
--
-- It cannot describe the other kind at all. "Shave three days after the last
-- shave" depends on completion history — shaving a day late should push the next
-- one a day out, not leave it where the calendar originally said. The rule needs
-- an anchor that moves, and no RRULE has one.
--
-- The use case is not new: it was written down in 2023, together with the visual
-- treatment it needs ("status normal, naranja y rojo cuando está retrasado").
--
-- Every existing row is FIXED, which is the behaviour it has today, so the
-- default is not a placeholder standing in for missing information: it is the
-- correct value for every row that exists.
CREATE TYPE "RecurrenceMode" AS ENUM ('FIXED', 'AFTER_COMPLETION');

ALTER TABLE "Schedule"
  ADD COLUMN "recurrenceMode" "RecurrenceMode" NOT NULL DEFAULT 'FIXED';
