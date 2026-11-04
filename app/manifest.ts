import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mi Curso',
    short_name: 'Mi Curso',
    description: 'Agenda colaborativa de pruebas, trabajos prácticos y novedades del curso.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f6f2',
    theme_color: '#445dce',
    orientation: 'any',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
