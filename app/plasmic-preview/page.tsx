'use client';

import { PlasmicComponent } from '@plasmicapp/loader-react';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClientPlasmicRootProvider } from '@/plasmic-init-client';
import { PLASMIC } from '@/plasmic-init';
import { MiCursoRuntime } from '@/components/mi-curso-runtime';

type PlasmicData = Awaited<ReturnType<typeof PLASMIC.fetchComponentData>>;

export default function PlasmicPreviewPage() {
  const [plasmicData, setPlasmicData] = useState<PlasmicData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void PLASMIC.fetchComponentData('Homepage')
      .then((data) => {
        if (active) setPlasmicData(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return <MiCursoRuntime />;
  }

  if (!plasmicData) {
    return <main className="loading-page"><LoaderCircle className="spin" size={28} /><span>Cargando diseño de Plasmic</span></main>;
  }

  return (
    <ClientPlasmicRootProvider prefetchedData={plasmicData}>
      <PlasmicComponent component="Homepage" />
    </ClientPlasmicRootProvider>
  );
}
