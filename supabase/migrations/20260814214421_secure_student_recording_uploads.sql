-- Uploads now use service-generated signed upload tokens after validating the
-- student's access code and classroom/story membership in the Edge Function.
DROP POLICY IF EXISTS "Public can upload voice recordings" ON storage.objects;

-- Public buckets already permit direct retrieval by URL. Removing this broad
-- SELECT policy prevents anonymous callers from enumerating recording objects.
DROP POLICY IF EXISTS "Public can read voice recordings" ON storage.objects;

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/ogg',
    'video/mp4',
    'application/octet-stream'
  ]::text[]
WHERE id = 'student-recordings';
