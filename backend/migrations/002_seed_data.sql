-- CivicEvents+ demo seed data
-- Run with: npm run db:seed   (or psql ... -f ./migrations/002_seed_data.sql)
--
-- Demo accounts (local development only — change or remove before any real deployment):
--   Admin: admin@civicevents.local / Admin@1234
--   User : user@civicevents.local  / User@1234
--
-- Safe to re-run: users are upserted by email, sample events/notifications are only
-- inserted when a row with the same title does not already exist.

INSERT INTO users (full_name, email, password_hash, role, is_active)
VALUES
    ('Platform Administrator', 'admin@civicevents.local',
     '$2b$10$bt9KsdzlSRAAAtCeuYDht.MozYd64cyj4.C7aByfsyTNVbvsB0XqK', 'admin', true),
    ('Demo Citizen', 'user@civicevents.local',
     '$2b$10$VLpMKLuObaWeAO2mx0gxJ.z.qqoBAC49TlW8TdMweUxLDWCDdhv.C', 'user', true)
ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role, is_active = true, updated_at = now();

INSERT INTO events (title, description, location, starts_at, ends_at, published)
SELECT * FROM (VALUES
    ('Community Clean-Up Day',
     'Join neighbours for a morning of cleaning streets, parks and drainage channels. Gloves, bags and refreshments are provided.',
     'Nyamirambo Stadium, Kigali',
     now() + interval '7 days', now() + interval '7 days 4 hours', true),
    ('Town Hall: City Budget 2027',
     'An open forum where residents can review the proposed city budget, ask questions and share priorities with local officials.',
     'Kigali Convention Centre',
     now() + interval '14 days', now() + interval '14 days 3 hours', true),
    ('Youth Innovation Fair',
     'Students and young entrepreneurs showcase projects that solve local challenges. Free entry for all residents.',
     'Kigali Public Library',
     now() + interval '21 days', now() + interval '21 days 6 hours', true),
    ('Road Safety Workshop',
     'Practical session on pedestrian and cyclist safety led by traffic police and community volunteers.',
     'Remera Sector Office',
     now() - interval '10 days', now() - interval '10 days' + interval '2 hours', true)
) AS v(title, description, location, starts_at, ends_at, published)
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = v.title);

INSERT INTO notifications (title, message, type, recipient_id, metadata)
SELECT 'Welcome to CivicEvents+',
       'Browse upcoming civic events, listen to announcements and watch community promos.',
       'system', NULL, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE title = 'Welcome to CivicEvents+');
