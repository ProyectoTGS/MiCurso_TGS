-- Las cuentas existentes conservan su estado. Los ingresos nuevos quedan
-- pendientes hasta que un administrador habilite su acceso.
alter table public.profiles alter column activo set default false;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
  requested_course uuid;
begin
  if new.raw_app_meta_data ->> 'provider' = 'google'
    and nullif(new.raw_user_meta_data ->> 'curso_id', '') is null then
    return new;
  end if;
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(new.email, 'alumno'), '@', 1)
  );
  requested_course := (new.raw_user_meta_data ->> 'curso_id')::uuid;
  insert into public.profiles (id, username, curso_id, role, activo)
  values (new.id, requested_username, requested_course, 'alumno', false);
  return new;
end;
$$;

drop policy if exists "alumno completa su perfil" on public.profiles;
create policy "alumno completa su perfil" on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'alumno' and activo = false);
