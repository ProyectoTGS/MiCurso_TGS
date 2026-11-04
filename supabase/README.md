# Configuración de Supabase

1. Ejecutá `schema.sql` en el editor SQL del proyecto.
2. Opcionalmente, ejecutá `seed.sql` para crear cursos de ejemplo. Los cursos
   que crea un profesor desde la app generan un código para invitar alumnos.
3. Configurá en el hosting:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
4. Registrá tu cuenta desde la aplicación.
5. Convertí esa cuenta en administradora desde el editor SQL:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'TU_EMAIL'
);
```

La aplicación no permite que un usuario se asigne el rol de administrador. Los
profesores crean una clase y comparten su código con sus alumnos. El historial
lo generan los triggers y los administradores pueden eliminar registros.

Para actualizar una instalación existente con clases por código, aplicá
`changes/clases-con-codigo.sql` una sola vez antes de publicar la nueva app.

## Acceso con Google

Para un proyecto existente, aplicá `changes/google-auth.sql` una sola vez. Creá
un cliente OAuth web en Google Cloud, configurá su URI de redirección como
`https://<project-ref>.supabase.co/auth/v1/callback` y cargá el ID y el secreto
en Authentication → Providers → Google de Supabase. Agregá las URL de la app
(incluida la de desarrollo, si corresponde) a la lista de redirecciones de
Supabase. Si la aplicación de Google está en modo de prueba, solo podrán entrar
los usuarios de prueba configurados en Google Cloud.

