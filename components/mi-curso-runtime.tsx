'use client';

import { Database, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { StudentApp } from '@/components/student-app';
import { getSupabaseClient } from '@/lib/supabase';
import type { Course, Profile } from '@/lib/mi-curso';

/**
 * The complete Mi Curso experience exposed as a reusable component.
 * Plasmic registers this component in its app host, while the regular
 * homepage keeps rendering the exact same runtime.
 */
export function MiCursoRuntime() {
  const supabase = getSupabaseClient();
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(() => !supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [needsProfile, setNeedsProfile] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [courseId, setCourseId] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const loadIdentity = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error?.code === 'PGRST116') {
      setNeedsProfile(userId);
      setReady(true);
      return;
    }
    if (error || !data) {
      setProfile(null);
      setCourse(null);
      setAuthMessage('No se pudo cargar tu perfil.');
      setReady(true);
      return;
    }
    const nextProfile = data as Profile;
    setNeedsProfile(null);
    if (!nextProfile.activo) {
      setProfile(null);
      setCourse(null);
      setPendingApproval(true);
      setReady(true);
      return;
    }
    setPendingApproval(false);
    if (nextProfile.role === 'admin') {
      window.location.replace('/admin');
      return;
    }
    const { data: courseData } = await supabase.from('cursos').select('*').eq('id', nextProfile.curso_id).single();
    setProfile(nextProfile);
    setCourse((courseData as Course | null) ?? null);
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    const themeLoad = window.setTimeout(() => setDark(localStorage.getItem('mi-curso-theme') === 'dark'), 0);
    return () => window.clearTimeout(themeLoad);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    void supabase.from('cursos').select('*').order('nombre').then(({ data }) => setCourses((data ?? []) as Course[]));
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) void loadIdentity(data.session.user.id);
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setCourse(null);
        setNeedsProfile(null);
        setPendingApproval(false);
        setReady(true);
      } else if (event === 'SIGNED_IN') {
        window.setTimeout(() => void loadIdentity(session.user.id), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadIdentity, supabase]);

  function toggleDark() {
    setDark((current) => {
      const next = !current;
      localStorage.setItem('mi-curso-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  async function completeProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !needsProfile || saving) return;
    setSaving(true);
    setAuthMessage('');
    const { error } = await supabase.from('profiles').insert({ id: needsProfile, username: username.trim(), curso_id: courseId });
    if (error) {
      setAuthMessage(error.code === '23505' ? 'Ese nombre de usuario ya está en uso. Elegí otro.' : 'No se pudo guardar tu perfil. Revisá los datos e intentá de nuevo.');
    } else {
      await loadIdentity(needsProfile);
    }
    setSaving(false);
  }

  if (!supabase) {
    return <main className={`setup-page ${dark ? 'dark' : ''}`}><section><Database size={30} /><h1>Configurar Supabase</h1><p>Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.</p></section></main>;
  }

  if (!ready) {
    return <main className={`loading-page ${dark ? 'dark' : ''}`}><LoaderCircle className="spin" size={28} /><span>Cargando</span></main>;
  }

  if (needsProfile) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Completá tu perfil</h1><p>Elegí un nombre de usuario y tu curso para continuar.</p><form onSubmit={completeProfile}>
      <label>Nombre de usuario<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required /></label>
      <label>Curso<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="">Elegí un curso</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
      {authMessage ? <p className="form-feedback" role="status">{authMessage}</p> : null}
      <button className="primary-button" disabled={saving || !courses.length}>{saving ? 'Guardando…' : 'Continuar'}</button>
      <button type="button" className="google-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
    </form></section></main>;
  }

  if (pendingApproval) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Acceso pendiente</h1><p>Tu cuenta todavía no tiene acceso al curso. Contactá a un administrador para que revise tu solicitud.</p><button className="primary-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></section></main>;
  }

  if (!profile || !course) {
    return <AuthScreen supabase={supabase} courses={courses} dark={dark} onToggleDark={toggleDark} message={authMessage} />;
  }

  return <StudentApp supabase={supabase} profile={profile} course={course} dark={dark} onToggleDark={toggleDark} onSignOut={() => void supabase.auth.signOut()} />;
}
