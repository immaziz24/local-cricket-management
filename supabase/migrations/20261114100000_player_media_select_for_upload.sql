drop policy if exists player_media_select_for_upload on storage.objects;
create policy player_media_select_for_upload on storage.objects for select to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = 'players'
  and private.can_edit_media(name)
);
