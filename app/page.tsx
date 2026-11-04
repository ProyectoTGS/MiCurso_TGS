import { MiCursoRuntime } from '@/components/mi-curso-runtime';
import PlasmicPreviewPage from '@/app/plasmic-preview/page';

export default function HomePage() {
  if (!process.env.NEXT_PUBLIC_PLASMIC_PROJECT_TOKEN) return <MiCursoRuntime />;
  return <PlasmicPreviewPage />;
}
