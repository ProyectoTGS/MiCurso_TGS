-- Run against Supabase as the database owner. Everything is rolled back.
begin;
select set_config('test.student', gen_random_uuid()::text, true);
select set_config('test.teacher', gen_random_uuid()::text, true);
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data) values
  (current_setting('test.student')::uuid, current_setting('test.student') || '@example.test', '{"provider":"email"}', jsonb_build_object('username','test-' || left(current_setting('test.student'),8),'tipo','alumno','role','admin')),
  (current_setting('test.teacher')::uuid, current_setting('test.teacher') || '@example.test', '{"provider":"email"}', jsonb_build_object('username','test-' || left(current_setting('test.teacher'),8),'tipo','profesor','role','admin'));
do $$ begin
  assert (select count(*) = 2 from public.profiles where id in (current_setting('test.student')::uuid,current_setting('test.teacher')::uuid) and role='alumno' and activo and curso_id is null), 'New accounts must have no admin privileges and no class';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
do $$ begin
  assert not private.is_admin(), 'Student must not be admin';
  assert (select count(*)=0 from public.cursos), 'Student without class must see no classes';
  assert (select count(*)=0 from public.publicaciones), 'Student without class must see no publications';
  begin
    perform public.crear_clase('Should not exist');
    raise exception 'Student was allowed to create a class';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_delete_user(gen_random_uuid());
    raise exception 'Student was allowed to call admin deletion';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role='admin' where id=auth.uid();
    raise exception 'Student was allowed to escalate their role';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.teacher'),true);
select set_config('test.class',public.crear_clase('Test ' || left(current_setting('test.teacher'),8))::text,true);
select set_config('test.code',public.mi_codigo_clase(),true);
do $$ begin
  assert not private.is_admin(), 'Teacher must not be admin';
  assert length(current_setting('test.code'))=12, 'Teacher needs a class code';
  begin
    perform public.admin_delete_user(gen_random_uuid());
    raise exception 'Teacher was allowed to call admin deletion';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
do $$ begin
  assert (select count(*)=0 from public.cursos), 'Class must stay hidden before joining';
  begin
    perform public.unirse_clase('INVALID-CODE');
    raise exception 'Invalid code accepted' using errcode='23514';
  exception when sqlstate 'P0001' then null; end;
end $$;
select public.unirse_clase(current_setting('test.code'));
insert into public.publicaciones(curso_id,materia,tipo,titulo,fecha)
values(current_setting('test.class')::uuid,'Historia','tp','Trabajo de prueba',current_date);
do $$ begin
  assert (select count(*)=1 from public.cursos), 'Student must see only the joined class';
  assert (select count(*)=1 from public.publicaciones), 'Student can participate in that class';
  assert not private.is_admin(), 'Joining must never grant admin';
end $$;
rollback;
select 'PASS: new accounts, teacher creation, student joining, class isolation and admin denial; all test data rolled back' as result;
