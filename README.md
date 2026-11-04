# Mi Curso

Aplicación de agenda para estudiantes, construida con React, vinext y Supabase.

## Desarrollo

1. Usá Node.js 22.13 o posterior e instalá las dependencias con `npm ci`.
2. Copiá `.env.example` a `.env.local` y completá la URL y la clave pública de Supabase. Para usar Plasmic, agregá el token del proyecto.
3. Ejecutá `npm run dev`.

Para preparar la base de datos y el acceso con Google, consultá [supabase/README.md](supabase/README.md). El proveedor Google requiere configuración adicional antes de funcionar.

La página principal carga `Homepage` desde Plasmic cuando se configura el token; si no está configurado o no se puede cargar el diseño, muestra la aplicación existente. Se usa el diseño publicado; para revisar borradores, configurá `NEXT_PUBLIC_PLASMIC_PREVIEW=true` en desarrollo. La aplicación actual sigue siendo un componente de código: sus elementos internos aún no son editables individualmente en Plasmic.
