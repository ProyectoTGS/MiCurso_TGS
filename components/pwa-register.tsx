'use client';

import { Download, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const initialState = window.setTimeout(() => {
      setInstalled(standalone);
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    }, 0);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDismissed(false);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.warn('No se pudo registrar la app instalable.', error);
      });
    }

    return () => {
      window.clearTimeout(initialState);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed || dismissed) return null;

  return (
    <aside className={`install-app-card ${showHelp ? 'expanded' : ''}`} aria-label="Instalar Mi Curso">
      <span className="install-app-icon"><Download size={19} /></span>
      <div>
        <strong>Instalar Mi Curso</strong>
        <small>Usala como app en tu celular o computadora.</small>
        {showHelp ? (
          <p>
            {isIos
              ? <>En Safari tocá <Share2 size={14} /> <b>Compartir</b> y después <b>Agregar a inicio</b>.</>
              : <>Abrí el menú del navegador y elegí <b>Instalar Mi Curso</b> o <b>Agregar a pantalla principal</b>.</>}
          </p>
        ) : null}
      </div>
      <button className="install-app-action" onClick={() => void install()}>{installPrompt ? 'Instalar' : 'Cómo instalar'}</button>
      <button className="install-app-close" onClick={() => setDismissed(true)} aria-label="Cerrar aviso de instalación"><X size={16} /></button>
    </aside>
  );
}
