-- Conservar el contenido del curso al eliminar una cuenta, sin conservar
-- una referencia a la cuenta eliminada.
alter table public.publicaciones alter column created_by drop not null;
alter table public.publicaciones alter column updated_by drop not null;
alter table public.historial alter column user_id drop not null;

alter table public.publicaciones drop constraint publicaciones_created_by_fkey;
alter table public.publicaciones add constraint publicaciones_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
alter table public.publicaciones drop constraint publicaciones_updated_by_fkey;
alter table public.publicaciones add constraint publicaciones_updated_by_fkey foreign key (updated_by) references public.profiles(id) on delete set null;
alter table public.historial drop constraint historial_user_id_fkey;
alter table public.historial add constraint historial_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.historial drop constraint historial_publicacion_id_fkey;
alter table public.historial add constraint historial_publicacion_id_fkey foreign key (publicacion_id) references public.publicaciones(id) on delete cascade;

grant delete on public.publicaciones, public.historial to authenticated;
create policy "admin elimina publicaciones" on public.publicaciones for delete to authenticated using ((select private.is_admin()));
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
  if not found then
    raise exception 'No se encontró una cuenta de alumno para eliminar.';
  end if;
  delete from auth.users where id = target_id;
  if not found then
    raise exception 'No se encontró la cuenta.';
  end if;
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
