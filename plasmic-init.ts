import { initPlasmicLoader } from '@plasmicapp/loader-react';

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: 'tkUxcMa1fk4NTpFdGgxj8E',
      token: process.env.NEXT_PUBLIC_PLASMIC_PROJECT_TOKEN ?? '',
    },
  ],
  // Keep draft mode enabled while the Plasmic transfer is being reviewed.
  preview: true,
});
