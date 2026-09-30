-- Quarantine accepts the original image format. Worker always re-encodes approved photos to JPEG.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  update storage.buckets
  set allowed_mime_types=array['application/pdf','image/jpeg','image/png']::text[]
  where id='quarantine';
 end if;
end $$;
