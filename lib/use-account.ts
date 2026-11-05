'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { Course, Profile } from '@/lib/mi-curso';

type Account = {
  loading: boolean;
  userId: string | null;
  email: string;
  profile: Profile | null;
  course: Course | null;
  inviteCode: string | null;
  error: string;
};

const EMPTY: Account = {
  loading: false, userId: null, email: '', profile: null,
  course: null, inviteCode: null, error: '',
};

// Shared by the homepage and /admin: changing session clears the old account.
export function useAccount() {
  const supabase = getSupabaseClient();
  const [account, setAccount] = useState<Account>({ ...EMPTY, loading: Boolean(supabase) });
  const revision = useRef(0);
  const cancel = useCallback(() => { ++revision.current; }, []);

  const invalidate = useCallback(() => {
    const request = ++revision.current;
    setAccount({ ...EMPTY, loading: true });
    return request;
  }, []);

  const load = useCallback(async (request: number) => {
    if (!supabase) return;
    const current = () => revision.current === request;
    try {
      // Verify with Auth instead of trusting the persisted session's user data.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (!user) {
        setAccount({ ...EMPTY, error: authError && authError.name !== 'AuthSessionMissingError' ? 'No se pudo verificar tu sesión. Intentá de nuevo.' : '' });
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      if (!current()) return;
      const profile = data as Profile | null;
      let course: Course | null = null;
      let inviteCode: string | null = null;
      if (profile?.activo && profile.role !== 'admin' && profile.curso_id) {
        const { data: classData, error: classError } = await supabase.from('cursos').select('*').eq('id', profile.curso_id).single();
        if (classError) throw classError;
        course = classData as Course;
        if (profile.es_profesor) {
          const { data: code, error: codeError } = await supabase.rpc('mi_codigo_clase');
          if (codeError) throw codeError;
          inviteCode = typeof code === 'string' ? code : null;
        }
      }
      if (current()) setAccount({ ...EMPTY, userId: user.id, email: user.email ?? '', profile, course, inviteCode });
    } catch {
      if (current()) setAccount({ ...EMPTY, error: 'No se pudo cargar tu cuenta. Intentá de nuevo.' });
    }
  }, [supabase]);

  const reload = useCallback(() => load(invalidate()), [invalidate, load]);

  useEffect(() => {
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      const request = invalidate();
      timer = setTimeout(() => void load(request), 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearTimeout(timer);
        cancel();
        setAccount(EMPTY);
      } else {
        // Finish Auth callbacks before making further Auth/API calls.
        schedule();
      }
    });
    schedule();
    return () => {
      clearTimeout(timer);
      cancel();
      subscription.unsubscribe();
    };
  }, [cancel, invalidate, load, supabase]);

  return { ...account, supabase, reload };
}
