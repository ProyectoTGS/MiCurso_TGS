-- Datos de prueba opcionales. Ejecutar después de schema.sql.
insert into public.cursos (nombre)
values
  ('1° A'), ('1° B'), ('1° C'), ('1° D'),
  ('2° A'), ('2° B'), ('2° C'), ('2° D'),
  ('3° A'), ('3° B'), ('3° C'), ('3° D'),
  ('4° A'), ('4° B'), ('4° C'), ('4° D'),
  ('5° A'), ('5° B'), ('5° C'), ('5° D'),
  ('6° A'), ('6° B'), ('6° C'), ('6° D')
on conflict (nombre) do nothing;

-- Las publicaciones requieren usuarios reales registrados porque created_by y
-- updated_by referencian profiles. Creá primero una cuenta desde la aplicación.

