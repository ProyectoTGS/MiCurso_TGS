-- Los alumnos pueden cambiar su clase mediante el código del profesor.
-- El propietario de una clase mantiene su acceso a ella.
create or replace function private.unirse_clase(codigo_clase text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare clase_encontrada uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles where id = (select auth.uid()) and activo and role = 'alumno'
  ) or exists (select 1 from private.codigos_clase where profesor_id = (select auth.uid())) then
    raise exception 'Esta cuenta no puede cambiar de clase.' using errcode = '42501';
  end if;
  select curso_id into clase_encontrada from private.codigos_clase where codigo = upper(trim(codigo_clase));
  if clase_encontrada is null then raise exception 'El código de clase no es válido.'; end if;
  update public.profiles set curso_id = clase_encontrada where id = (select auth.uid());
  return clase_encontrada;
end;
$$;
