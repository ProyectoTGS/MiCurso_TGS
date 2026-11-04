# Configuración de Supabase

1. Ejecutá `schema.sql` en el editor SQL del proyecto.
2. Ejecutá `seed.sql` para crear el curso de ejemplo.
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

La aplicación no permite cambiar roles desde la interfaz. El Historial tampoco
se puede insertar, editar ni borrar mediante la API: lo generan los triggers.

## Acceso con Google

Para un proyecto existente, aplicá `changes/google-auth.sql` una sola vez. Creá
un cliente OAuth web en Google Cloud, configurá su URI de redirección como
`https://<project-ref>.supabase.co/auth/v1/callback` y cargá el ID y el secreto
en Authentication → Providers → Google de Supabase. Agregá las URL de la app
(incluida la de desarrollo, si corresponde) a la lista de redirecciones de
Supabase. Si la aplicación de Google está en modo de prueba, solo podrán entrar
los usuarios de prueba configurados en Google Cloud.

