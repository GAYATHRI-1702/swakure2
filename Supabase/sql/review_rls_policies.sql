-- Row-level security policies the app relies on. NOT applied automatically — review before running.
--
-- 1. First list what already exists. Permissive policies are OR-ed together, so an existing broad policy
--    (e.g. USING (true)) would make the policies below ineffective:
--      select tablename, policyname, cmd, roles, qual, with_check
--      from pg_policies where schemaname = 'public'
--        and tablename in ('appointments', 'reminders', 'prescription_medicines', 'prescriptions');
--      select relname, relrowsecurity from pg_class
--      where relname in ('appointments', 'reminders', 'prescription_medicines');
-- 2. If RLS is currently DISABLED on a table, enabling it blocks every query that has no matching policy.
--    The app's own queries are covered below; anything else using the anon/authenticated key is not.
-- 3. Run in a staging project or a transaction first, then test booking, cancelling, reminders and
--    the prescription detail view while signed in.

alter table public.appointments enable row level security;
alter table public.reminders enable row level security;
alter table public.prescription_medicines enable row level security;

do $$
begin
  -- appointments ---------------------------------------------------------------------------------
  -- App queries: select own rows; insert with status 'pending'; update status -> 'cancelled' on a pending row.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_select_own') then
    create policy appointments_select_own on public.appointments
      for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  -- Patients can only create pending bookings for themselves (cannot self-insert 'confirmed').
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_insert_own') then
    create policy appointments_insert_own on public.appointments
      for insert to authenticated
      with check ((select auth.uid()) = user_id and status = 'pending');
  end if;

  -- Patients can only cancel their own pending bookings (cannot mark them confirmed/completed).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_cancel_own') then
    create policy appointments_cancel_own on public.appointments
      for update to authenticated
      using ((select auth.uid()) = user_id and status = 'pending')
      with check ((select auth.uid()) = user_id and status = 'cancelled');
  end if;
  -- No DELETE policy on purpose: the app never deletes appointments.

  -- reminders -------------------------------------------------------------------------------------
  -- App queries: select, insert, update (is_active toggle) and delete, all on the user's own rows.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reminders' and policyname = 'reminders_all_own') then
    create policy reminders_all_own on public.reminders
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  -- prescription_medicines ------------------------------------------------------------------------
  -- No user_id column: readable only when the parent prescription belongs to the user.
  -- Read-only for users. Whatever writes these rows (the analyze-prescription function, once implemented)
  -- must use the service role key or get its own INSERT policy, otherwise its inserts will be rejected.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prescription_medicines' and policyname = 'prescription_medicines_select_own') then
    create policy prescription_medicines_select_own on public.prescription_medicines
      for select to authenticated
      using (exists (
        select 1 from public.prescriptions p
        where p.id = prescription_medicines.prescription_id
          and p.user_id = (select auth.uid())
      ));
  end if;
end $$;

-- Table privileges: policies have no effect without them, and newer Supabase projects no longer grant
-- them automatically. Check the current state first:
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated')
--     and table_name in ('appointments', 'reminders', 'prescription_medicines', 'prescription_analysis', 'prescription_ocr_results')
--   order by 1, 2, 3;
-- Granting a privilege that already exists is a no-op.
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select on public.prescription_medicines to authenticated;

-- The analyze-prescription Edge Function writes with the service role. Service role bypasses RLS but still
-- needs table privileges (projects created recently do not get them automatically).
grant select, update on public.prescriptions to service_role;
grant select, insert, update, delete on public.prescription_ocr_results, public.prescription_analysis, public.prescription_medicines
  to service_role;

-- Analysis results are written only by the analyze-prescription Edge Function (service role).
-- Users must not be able to insert, change or delete them directly.
revoke insert, update, delete on public.prescription_medicines, public.prescription_analysis, public.prescription_ocr_results
  from anon, authenticated;

-- Optional hardening: limit what a patient can change on an appointment to the status column only.
-- revoke update on public.appointments from authenticated;
-- grant update (status) on public.appointments to authenticated;

-- Optional: anon currently has SELECT on public.appointments (RLS keeps it empty); the app does not need it.
-- revoke select on public.appointments from anon;

-- Indexes that keep these policies fast (skip any that already exist):
-- create index if not exists appointments_user_id_idx on public.appointments (user_id);
-- create index if not exists reminders_user_id_idx on public.reminders (user_id);
-- create index if not exists prescription_medicines_prescription_id_idx on public.prescription_medicines (prescription_id);
