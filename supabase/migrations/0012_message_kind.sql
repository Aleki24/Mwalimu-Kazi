-- A notification kind for messages.
--
-- Its own migration because ALTER TYPE ... ADD VALUE cannot be used by
-- anything in the same transaction that added it, and 0013 defines a trigger
-- that writes this value.
alter type notification_kind add value 'message';
