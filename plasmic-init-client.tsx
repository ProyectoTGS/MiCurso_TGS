'use client';

import { PlasmicRootProvider } from '@plasmicapp/loader-react';
import { MiCursoRuntime } from '@/components/mi-curso-runtime';
import { PLASMIC } from '@/plasmic-init';

PLASMIC.registerComponent(MiCursoRuntime, {
  name: 'MiCursoApp',
  displayName: 'Mi Curso — aplicación real',
  importPath: '@/components/mi-curso-runtime',
  importName: 'MiCursoRuntime',
  props: {},
});

export function ClientPlasmicRootProvider(
  props: Omit<React.ComponentProps<typeof PlasmicRootProvider>, 'loader'>,
) {
  return <PlasmicRootProvider loader={PLASMIC} {...props} />;
}
