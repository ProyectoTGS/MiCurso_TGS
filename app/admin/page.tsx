'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPanel } from '@/components/admin-panel';
import { getSupabaseClient } from '@/lib/supabase';
import type { Profile } from '@/lib/mi-curso';

export default function AdminPage() {
  const supabase = getSupabaseClient();
  const [admin, setAdmin] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.replace('/');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
      if (!profile || (profile as Profile).role !== 'admin' || !(profile as Profile).activo) {
        window.location.replace('/');
        return;
      }
      setAdmin(profile as Profile);
      setChecking(false);
    });
  }, [supabase]);

  if (!supabase) return <main className="loading-page"><span>Falta configurar Supabase.</span></main>;
  if (checking || !admin) return <main className="loading-page"><LoaderCircle className="spin" size={28} /><span>Verificando acceso</span></main>;
  return <AdminPanel supabase={supabase} admin={admin} />;
}

