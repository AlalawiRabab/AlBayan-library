-- Recordings contain student voice data and must not be public assets.
-- Authorized teacher/admin reads now receive one-hour signed URLs from the
-- secure Edge Function gateway.
UPDATE storage.buckets
SET public = false
WHERE id = 'student-recordings';
