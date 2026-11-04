import { initPlasmicLoader } from '@plasmicapp/loader-react';

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: 'tkUxcMa1fk4NTpFdGgxj8E',
      token: process.env.NEXT_PUBLIC_PLASMIC_PROJECT_TOKEN ?? '',
    },
  ],
  // Public pages use the published design unless preview is explicitly enabled.
  preview: process.env.NEXT_PUBLIC_PLASMIC_PREVIEW === 'true',
});
