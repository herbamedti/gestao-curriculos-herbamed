-- Quarantine accepts the original image format. Worker always re-encodes approved photos to JPEG.
update storage.buckets
set allowed_mime_types=array['application/pdf','image/jpeg','image/png']::text[]
where id='quarantine';
