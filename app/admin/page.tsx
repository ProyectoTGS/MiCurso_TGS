'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { AdminPanel } from '@/components/admin-panel';
import { useAccount } from '@/lib/use-account';

export default function AdminPage() {
  const { supabase, profile, email, loading, error, reload } = useAccount();
  const allowed = profile?.role === 'admin' && profile.activo;

  useEffect(() => {
    if (!loading && !error && !allowed) window.location.replace('/');
  }, [allowed, error, loading]);

  if (!supabase) return <main className="loading-page"><span>Falta configurar Supabase.</span></main>;
  if (error) return <main className="loading-page"><p role="alert">{error}</p><button className="primary-button" onClick={() => void reload()}>Reintentar</button></main>;
  if (loading || !allowed) return <main className="loading-page"><LoaderCircle className="spin" size={28} /><span>Verificando acceso</span></main>;
  return <AdminPanel key={profile.id} supabase={supabase} admin={profile} email={email} />;
}

