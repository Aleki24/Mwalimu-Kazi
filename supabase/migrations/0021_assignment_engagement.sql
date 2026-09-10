-- 'assignment' as a fourth kind of work: a one-off piece rather than an
-- ongoing arrangement — marking a set of scripts, writing a scheme of work,
-- coaching through one exam. It sits alongside tuition and homeschooling as a
-- private request, with the same rules.
--
-- Its own migration because ALTER TYPE ADD VALUE cannot run in the same
-- transaction as anything that then uses the new value. 0012 learned this.
alter type engagement_kind add value 'assignment';
