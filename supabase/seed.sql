-- The switchable features (spec §8.1), all on for every student until an admin changes them.
insert into public.feature_switches (key, enabled_for_all) values
  ('ai_doubts', true),
  ('speaking_practice', true),
  ('placement_test', true),
  ('english_only_option', true),
  ('mentor_booking', true),
  ('community_feed', true)
on conflict (key) do nothing;
