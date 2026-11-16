create policy tournament_media_select_for_upload on storage.objects for select to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'tournaments'
  and private.can_edit_media(name)
);
