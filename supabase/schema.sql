-- Mi Curso · esquema completo para Supabase
-- Ejecutar como una migración en un proyecto nuevo o vacío.

create extension if not exists pgcrypto;
create extension if not exists citext with schema extensions;
create schema if not exists private;

create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (char_length(trim(nombre)) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username extensions.citext not null unique check (char_length(trim(username::text)) between 2 and 40),
  curso_id uuid not null references public.cursos(id),
  role text not null default 'alumno' check (role in ('alumno', 'admin')),
  activo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  materia text not null check (materia in ('Historia', 'Matemática', 'Lengua y Literatura', 'Biología', 'Inglés', 'Física', 'Química')),
  tipo text not null check (tipo in ('prueba', 'tp')),
  titulo text not null check (char_length(trim(titulo)) between 2 and 100),
  fecha date not null,
  nota text check (nota is null or char_length(nota) <= 240),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  borrada boolean not null default false
);

create table if not exists public.historial (
  id bigint generated always as identity primary key,
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  curso_id uuid not null references public.cursos(id),
  user_id uuid references public.profiles(id) on delete set null,
  accion text not null check (accion in ('publicó', 'editó', 'borró', 'restauró')),
  cambios jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_curso_id_idx on public.profiles(curso_id);
create index if not exists publicaciones_curso_fecha_idx on public.publicaciones(curso_id, fecha);
create index if not exists publicaciones_created_by_idx on public.publicaciones(created_by);
create index if not exists publicaciones_updated_by_idx on public.publicaciones(updated_by);
create index if not exists historial_curso_created_idx on public.historial(curso_id, created_at desc);
create index if not exists historial_publicacion_idx on public.historial(publicacion_id);
create index if not exists historial_user_idx on public.historial(user_id);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and activo = true
      and role = 'admin'
  );
$$;

create or replace function private.current_curso_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select curso_id
  from public.profiles
  where id = (select auth.uid())
    and activo = true;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if new.id is distinct from old.id or new.role is distinct from old.role or new.created_at is distinct from old.created_at then
      raise exception 'No se puede modificar el id, rol o fecha de creación.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function private.protect_profile_fields();

create or replace function private.prepare_publication_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
      new.updated_by := (select auth.uid());
    end if;
    new.updated_at := now();
    return new;
  end if;

  if (select auth.uid()) is not null then
    if not private.is_admin() then
      if old.curso_id is distinct from new.curso_id
        or old.created_by is distinct from new.created_by
        or old.created_at is distinct from new.created_at
        or old.borrada is distinct from new.borrada then
        raise exception 'Los alumnos no pueden cambiar el curso, autor ni estado de una publicación.';
      end if;
    end if;
    new.updated_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_publication_write on public.publicaciones;
create trigger prepare_publication_write
  before insert or update on public.publicaciones
  for each row execute function private.prepare_publication_write();

create or replace function private.audit_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_name text;
  actor_id uuid;
  change_set jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    action_name := 'publicó';
    actor_id := new.created_by;
    change_set := jsonb_build_object('publicacion', to_jsonb(new));
  else
    actor_id := new.updated_by;
    if old.borrada = false and new.borrada = true then
      action_name := 'borró';
      change_set := jsonb_build_object('publicacion', to_jsonb(old));
    elsif old.borrada = true and new.borrada = false then
      action_name := 'restauró';
      change_set := jsonb_build_object('publicacion', to_jsonb(new));
    else
      action_name := 'editó';
      if old.materia is distinct from new.materia then change_set := change_set || jsonb_build_object('materia', jsonb_build_object('anterior', old.materia, 'nuevo', new.materia)); end if;
      if old.tipo is distinct from new.tipo then change_set := change_set || jsonb_build_object('tipo', jsonb_build_object('anterior', old.tipo, 'nuevo', new.tipo)); end if;
      if old.titulo is distinct from new.titulo then change_set := change_set || jsonb_build_object('titulo', jsonb_build_object('anterior', old.titulo, 'nuevo', new.titulo)); end if;
      if old.fecha is distinct from new.fecha then change_set := change_set || jsonb_build_object('fecha', jsonb_build_object('anterior', old.fecha, 'nuevo', new.fecha)); end if;
      if old.nota is distinct from new.nota then change_set := change_set || jsonb_build_object('nota', jsonb_build_object('anterior', old.nota, 'nuevo', new.nota)); end if;
      if old.curso_id is distinct from new.curso_id then change_set := change_set || jsonb_build_object('curso_id', jsonb_build_object('anterior', old.curso_id, 'nuevo', new.curso_id)); end if;
      if change_set = '{}'::jsonb then return new; end if;
    end if;
  end if;

  insert into public.historial (publicacion_id, curso_id, user_id, accion, cambios)
  values (new.id, new.curso_id, actor_id, action_name, change_set);
  return new;
end;
$$;

drop trigger if exists audit_publication on public.publicaciones;
create trigger audit_publication
  after insert or update on public.publicaciones
  for each row execute function private.audit_publication();

alter table public.cursos enable row level security;
alter table public.profiles enable row level security;
alter table public.publicaciones enable row level security;
alter table public.historial enable row level security;

revoke all on table public.cursos, public.profiles, public.publicaciones, public.historial from anon, authenticated;
grant select on table public.cursos to anon, authenticated;
grant insert, update on table public.cursos to authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, username, curso_id) on public.profiles to authenticated;
grant update (username, curso_id, activo) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.publicaciones to authenticated;
grant select, delete on table public.historial to authenticated;

grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public;
revoke all on function private.current_curso_id() from public;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_curso_id() to authenticated;
revoke all on function private.handle_new_user() from public;
revoke all on function private.protect_profile_fields() from public;
revoke all on function private.prepare_publication_write() from public;
revoke all on function private.audit_publication() from public;

drop policy if exists "cursos visibles" on public.cursos;
create policy "cursos visibles" on public.cursos for select to anon, authenticated using (true);
drop policy if exists "admin crea cursos" on public.cursos;
create policy "admin crea cursos" on public.cursos for insert to authenticated with check ((select private.is_admin()));
drop policy if exists "admin edita cursos" on public.cursos;
create policy "admin edita cursos" on public.cursos for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "perfiles del curso" on public.profiles;
create policy "perfiles del curso" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (select private.is_admin())
  or (activo = true and curso_id = (select private.current_curso_id()))
);
drop policy if exists "admin edita perfiles" on public.profiles;
create policy "admin edita perfiles" on public.profiles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "alumno completa su perfil" on public.profiles;
create policy "alumno completa su perfil" on public.profiles for insert to authenticated with check (
  id = (select auth.uid()) and role = 'alumno' and activo = false
);

drop policy if exists "publicaciones del curso" on public.publicaciones;
create policy "publicaciones del curso" on public.publicaciones for select to authenticated using (
  (select private.is_admin())
  or curso_id = (select private.current_curso_id())
);
drop policy if exists "alumnos publican en su curso" on public.publicaciones;
create policy "alumnos publican en su curso" on public.publicaciones for insert to authenticated with check (
  curso_id = (select private.current_curso_id())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and borrada = false
);
drop policy if exists "alumnos editan su curso" on public.publicaciones;
create policy "alumnos editan su curso" on public.publicaciones for update to authenticated using (
  (select private.is_admin())
  or (curso_id = (select private.current_curso_id()) and borrada = false)
) with check (
  (select private.is_admin())
  or curso_id = (select private.current_curso_id())
);

drop policy if exists "historial del curso" on public.historial;
create policy "historial del curso" on public.historial for select to authenticated using (
  (select private.is_admin())
  or curso_id = (select private.current_curso_id())
);

drop policy if exists "admin elimina publicaciones" on public.publicaciones;
create policy "admin elimina publicaciones" on public.publicaciones for delete to authenticated using ((select private.is_admin()));
drop policy if exists "admin elimina historial" on public.historial;
create policy "admin elimina historial" on public.historial for delete to authenticated using ((select private.is_admin()));

create or replace function private.admin_delete_user(target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'No tenés permiso para eliminar cuentas.' using errcode = '42501';
  end if;
  if target_id = (select auth.uid()) then
    raise exception 'No podés eliminar tu propia cuenta.';
  end if;
  perform 1 from public.profiles where id = target_id and role = 'alumno' for update;
  if not found then raise exception 'No se encontró una cuenta de alumno para eliminar.'; end if;
  delete from auth.users where id = target_id;
  if not found then raise exception 'No se encontró la cuenta.'; end if;
end;
$$;
revoke all on function private.admin_delete_user(uuid) from public, anon;
grant execute on function private.admin_delete_user(uuid) to authenticated;
create or replace function public.admin_delete_user(target_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.admin_delete_user(target_id);
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'publicaciones') then
    alter publication supabase_realtime add table public.publicaciones;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'historial') then
    alter publication supabase_realtime add table public.historial;
  end if;
end $$;

