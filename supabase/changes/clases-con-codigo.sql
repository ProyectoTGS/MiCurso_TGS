-- Clases creadas por profesores y acceso con código. Los cursos existentes
-- y sus publicaciones se conservan.
alter table public.profiles alter column curso_id drop not null;
alter table public.profiles add column if not exists es_profesor boolean not null default false;
alter table public.profiles alter column activo set default true;
update public.profiles set activo = true where role = 'alumno' and activo = false;
alter table public.cursos drop constraint if exists cursos_nombre_key;

create table private.codigos_clase (
  curso_id uuid primary key references public.cursos(id) on delete cascade,
  profesor_id uuid not null references public.profiles(id) on delete cascade,
  codigo text not null unique
);
revoke all on private.codigos_clase from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare requested_username text;
begin
  if new.raw_app_meta_data ->> 'provider' = 'google' then return new; end if;
  requested_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  if requested_username is null then return new; end if;
  insert into public.profiles (id, username, curso_id, role, activo, es_profesor)
  values (new.id, requested_username, null, 'alumno', true, coalesce(new.raw_user_meta_data ->> 'tipo' = 'profesor', false));
  return new;
end;
$$;

grant insert (es_profesor) on public.profiles to authenticated;
drop policy if exists "alumno completa su perfil" on public.profiles;
create policy "alumno completa su perfil" on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'alumno' and activo = true and curso_id is null);

drop policy if exists "cursos visibles" on public.cursos;
revoke select on public.cursos from anon;
create policy "cursos visibles" on public.cursos for select to authenticated
using ((select private.is_admin()) or id = (select private.current_curso_id()));

create function private.crear_clase(nombre_clase text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare nueva_clase uuid; codigo_nuevo text;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid()) and activo and es_profesor and curso_id is null) then
    raise exception 'Necesitás una cuenta de profesor sin clase para crearla.' using errcode = '42501';
  end if;
  if length(trim(nombre_clase)) < 2 or length(trim(nombre_clase)) > 40 then raise exception 'El nombre debe tener entre 2 y 40 caracteres.'; end if;
  insert into public.cursos (nombre) values (trim(nombre_clase)) returning id into nueva_clase;
  codigo_nuevo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into private.codigos_clase (curso_id, profesor_id, codigo) values (nueva_clase, (select auth.uid()), codigo_nuevo);
  update public.profiles set curso_id = nueva_clase where id = (select auth.uid()) and curso_id is null;
  if not found then raise exception 'La cuenta ya tiene una clase.'; end if;
  return nueva_clase;
end;
$$;
create function private.unirse_clase(codigo_clase text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare clase_encontrada uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid()) and activo and curso_id is null) then
    raise exception 'Necesitás una cuenta sin clase para unirte.' using errcode = '42501';
  end if;
  select curso_id into clase_encontrada from private.codigos_clase where codigo = upper(trim(codigo_clase));
  if clase_encontrada is null then raise exception 'El código de clase no es válido.'; end if;
  update public.profiles set curso_id = clase_encontrada where id = (select auth.uid()) and curso_id is null;
  if not found then raise exception 'La cuenta ya tiene una clase.'; end if;
  return clase_encontrada;
end;
$$;
create function private.mi_codigo_clase()
returns text language sql stable security definer set search_path = '' as $$
  select codigo from private.codigos_clase where profesor_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = (select auth.uid()) and activo);
$$;
revoke all on function private.crear_clase(text), private.unirse_clase(text), private.mi_codigo_clase() from public, anon;
grant execute on function private.crear_clase(text), private.unirse_clase(text), private.mi_codigo_clase() to authenticated;

create function public.crear_clase(nombre_clase text) returns uuid language sql security invoker set search_path = '' as $$ select private.crear_clase(nombre_clase); $$;
create function public.unirse_clase(codigo_clase text) returns uuid language sql security invoker set search_path = '' as $$ select private.unirse_clase(codigo_clase); $$;
create function public.mi_codigo_clase() returns text language sql stable security invoker set search_path = '' as $$ select private.mi_codigo_clase(); $$;
revoke all on function public.crear_clase(text), public.unirse_clase(text), public.mi_codigo_clase() from public, anon;
grant execute on function public.crear_clase(text), public.unirse_clase(text), public.mi_codigo_clase() to authenticated;
