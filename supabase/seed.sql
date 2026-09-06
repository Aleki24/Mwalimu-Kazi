-- Sample data for development. All schools, salaries and vacancies here are
-- invented — no real institution is described, rated or flagged.
--
-- Applied with the service role, which bypasses RLS. Profiles are NOT seeded:
-- they key off auth.users, so they arrive when a real account signs up.

insert into schools (name, slug, county, school_type, curricula, verification, teacher_count) values
  ('Greenfield Academy',           'greenfield-academy',           'nairobi', 'private',       '{cbc,igcse}', 'verified',     120),
  ('Sunrise International School', 'sunrise-international-school', 'nairobi', 'international', '{ib}',        'verified',      85),
  ('Riverbank Academy',            'riverbank-academy',            'kiambu',  'private',       '{igcse}',     'verified',      60),
  ('Little Angels School',         'little-angels-school',         'kisumu',  'private',       '{cbc}',       'verified',      34),
  ('Hilltop Junior School',        'hilltop-junior-school',        'nairobi', 'private',       '{cbc}',       'verified',      48),
  ('Westgate Hills Academy',       'westgate-hills-academy',       'nakuru',  'private',       '{cbc}',       'pending',       27)
on conflict (slug) do nothing;

-- Requirements are the input to matchScore(); the shape matches JobRequirement
-- in packages/types. `weight` decides its share of the score, `mustHave` makes
-- it a hard gate.
insert into jobs (school_id, title, subjects, job_type, county, salary_min, salary_max, requirements, published, posted_at, closes_at)
select s.id, v.title, v.subjects, v.job_type::job_type, v.county, v.salary_min, v.salary_max, v.requirements::jsonb, true,
       now() - (v.posted_hours || ' hours')::interval,
       case when v.closes_days is null then null else now() + (v.closes_days || ' days')::interval end
from (values
  ('greenfield-academy', 'Mathematics Teacher', '{mathematics}'::text[], 'full_time', 'nairobi', 45000, 60000, 2, 6,
   '[{"kind":"subject","value":"mathematics","label":"Mathematics","weight":4,"mustHave":true},
     {"kind":"qualification","value":"degree","label":"Bachelor''s degree in Education","weight":2,"mustHave":false},
     {"kind":"experience_years","value":"3","label":"3+ years experience","weight":2,"mustHave":false},
     {"kind":"tsc_registration","value":"required","label":"TSC registration","weight":2,"mustHave":true},
     {"kind":"curriculum","value":"igcse","label":"IGCSE experience","weight":1,"mustHave":false}]'),

  ('riverbank-academy', 'Physics Teacher', '{physics}'::text[], 'full_time', 'kiambu', 42000, 55000, 5, 11,
   '[{"kind":"subject","value":"physics","label":"Physics","weight":4,"mustHave":true},
     {"kind":"experience_years","value":"2","label":"2+ years experience","weight":2,"mustHave":false},
     {"kind":"curriculum","value":"igcse","label":"IGCSE experience","weight":2,"mustHave":false}]'),

  ('sunrise-international-school', 'ICT Teacher', '{ict,computer-studies}'::text[], 'full_time', 'nairobi', 50000, 70000, 26, 20,
   '[{"kind":"subject","value":"ict","label":"ICT","weight":4,"mustHave":true},
     {"kind":"qualification","value":"degree","label":"Degree in Computer Science or Education","weight":2,"mustHave":true},
     {"kind":"curriculum","value":"ib","label":"IB experience","weight":2,"mustHave":false}]'),

  ('little-angels-school', 'Grade 6 Class Teacher', '{primary}'::text[], 'contract', 'kisumu', 32000, 38000, 30, 4,
   '[{"kind":"subject","value":"primary","label":"Primary teaching","weight":3,"mustHave":true},
     {"kind":"curriculum","value":"cbc","label":"CBC training","weight":3,"mustHave":true},
     {"kind":"experience_years","value":"1","label":"1+ year experience","weight":1,"mustHave":false}]'),

  ('hilltop-junior-school', 'Mathematics Teacher', '{mathematics}'::text[], 'full_time', 'nairobi', 38000, 48000, 8, 1,
   '[{"kind":"subject","value":"mathematics","label":"Mathematics","weight":4,"mustHave":true},
     {"kind":"curriculum","value":"cbc","label":"CBC training","weight":2,"mustHave":false},
     {"kind":"tsc_registration","value":"required","label":"TSC registration","weight":2,"mustHave":false}]'),

  ('greenfield-academy', 'Kiswahili Teacher', '{kiswahili}'::text[], 'part_time', 'nairobi', null, null, 48, 14,
   '[{"kind":"subject","value":"kiswahili","label":"Kiswahili","weight":4,"mustHave":true},
     {"kind":"experience_years","value":"2","label":"2+ years experience","weight":1,"mustHave":false}]'),

  ('westgate-hills-academy', 'Chemistry Teacher', '{chemistry}'::text[], 'full_time', 'nakuru', 30000, 36000, 72, 9,
   '[{"kind":"subject","value":"chemistry","label":"Chemistry","weight":4,"mustHave":true},
     {"kind":"experience_years","value":"5","label":"5+ years experience","weight":2,"mustHave":false}]'),

  ('sunrise-international-school', 'Head of Mathematics', '{mathematics}'::text[], 'full_time', 'nairobi', 90000, 120000, 96, 25,
   '[{"kind":"subject","value":"mathematics","label":"Mathematics","weight":3,"mustHave":true},
     {"kind":"qualification","value":"degree","label":"Degree in Mathematics","weight":2,"mustHave":true},
     {"kind":"experience_years","value":"8","label":"8+ years experience","weight":3,"mustHave":true},
     {"kind":"curriculum","value":"ib","label":"IB experience","weight":2,"mustHave":false}]')
) as v(school_slug, title, subjects, job_type, county, salary_min, salary_max, posted_hours, closes_days, requirements)
join schools s on s.slug = v.school_slug;
