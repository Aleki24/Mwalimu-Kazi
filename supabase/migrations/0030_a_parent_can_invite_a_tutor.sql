-- Being invited is not the same as applying.
--
-- A parent who browses the tutor directory and gets in touch has not received
-- an application — they went looking. Recording it as `manual` would put
-- "Applied" on the screen beside somebody who did no such thing, which is the
-- kind of small lie that makes the rest of a screen untrustworthy.
--
-- Alone in its own migration because `alter type ... add value` cannot share a
-- transaction with anything that uses the value, and this repo learned that
-- the hard way in 0021.

alter type application_source add value if not exists 'invited';
