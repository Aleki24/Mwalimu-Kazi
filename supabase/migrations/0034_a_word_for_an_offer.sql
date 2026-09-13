-- A word for an offer.
--
-- `notification_kind` was written with the whole hiring pipeline in mind and
-- stopped one short: application_viewed, shortlisted, interview_invite and
-- rejected are all there, and the one moment a teacher most wants to hear
-- about has no name. 0035 needs it to tell somebody they got the job.
--
-- Alone in its own migration because `alter type … add value` cannot run in
-- the same transaction as anything that then uses the new value.

alter type notification_kind add value if not exists 'offered';
