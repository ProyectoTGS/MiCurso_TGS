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
  const [authMessage, setAuthMessage] = useState('');
  const [needsProfile, setNeedsProfile] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [teacher, setTeacher] = useState(false);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
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
    setInviteCode(null);
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
    if (!nextProfile.curso_id) {
      setProfile(nextProfile);
      setCourse(null);
      setReady(true);
      return;
    }
    const { data: courseData } = await supabase.from('cursos').select('*').eq('id', nextProfile.curso_id).single();
    if (nextProfile.es_profesor) {
      const { data: code } = await supabase.rpc('mi_codigo_clase');
      setInviteCode(typeof code === 'string' ? code : null);
    }
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

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) void loadIdentity(data.session.user.id);
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setCourse(null);
        setNeedsProfile(null);
        setInviteCode(null);
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
    const { error } = await supabase.from('profiles').insert({ id: needsProfile, username: username.trim(), curso_id: null, es_profesor: teacher });
    if (error) {
      setAuthMessage(error.code === '23505' ? 'Ese nombre de usuario ya está en uso. Elegí otro.' : 'No se pudo guardar tu perfil. Revisá los datos e intentá de nuevo.');
    } else {
      await loadIdentity(needsProfile);
    }
    setSaving(false);
  }

  async function handleClass(event: React.FormEvent<HTMLFormElement>, action: 'create' | 'join') {
    event.preventDefault();
    if (!supabase || !profile || saving) return;
    setSaving(true);
    setAuthMessage('');
    const { error } = action === 'create'
      ? await supabase.rpc('crear_clase', { nombre_clase: className.trim() })
      : await supabase.rpc('unirse_clase', { codigo_clase: classCode.trim() });
    if (error) setAuthMessage(error.message);
    else await loadIdentity(profile.id);
    setSaving(false);
  }

  if (!supabase) {
    return <main className={`setup-page ${dark ? 'dark' : ''}`}><section><Database size={30} /><h1>Configurar Supabase</h1><p>Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.</p></section></main>;
  }

  if (!ready) {
    return <main className={`loading-page ${dark ? 'dark' : ''}`}><LoaderCircle className="spin" size={28} /><span>Cargando</span></main>;
  }

  if (needsProfile) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Completá tu perfil</h1><p>Elegí un nombre de usuario y el tipo de cuenta para continuar.</p><form onSubmit={completeProfile}>
      <label>Nombre de usuario<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required /></label>
      <label>Tipo de cuenta<select value={teacher ? 'profesor' : 'alumno'} onChange={(event) => setTeacher(event.target.value === 'profesor')}><option value="alumno">Soy alumno</option><option value="profesor">Soy profesor</option></select></label>
      {authMessage ? <p className="form-feedback" role="status">{authMessage}</p> : null}
      <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Continuar'}</button>
      <button type="button" className="google-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
    </form></section></main>;
  }

  if (profile && !course && !profile.curso_id) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Hola, {profile.username}</h1><p>Unite a una clase para ver su tablón.{profile.es_profesor ? ' También podés crear una clase y compartir su código.' : ''}</p>
      {profile.es_profesor ? <form onSubmit={(event) => void handleClass(event, 'create')}><label>Nombre de la clase<input value={className} onChange={(event) => setClassName(event.target.value)} minLength={2} maxLength={40} required /></label><button className="primary-button" disabled={saving}>Crear clase</button></form> : null}
      <form onSubmit={(event) => void handleClass(event, 'join')}><label>Código de clase<input value={classCode} onChange={(event) => setClassCode(event.target.value.toUpperCase())} maxLength={12} required /></label><button className="google-button" disabled={saving}>Unirme a una clase</button></form>
      {authMessage ? <p className="form-feedback" role="status">{authMessage}</p> : null}<button type="button" className="google-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></section></main>;
  }

  if (pendingApproval) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Acceso pendiente</h1><p>Tu cuenta todavía no tiene acceso al curso. Contactá a un administrador para que revise tu solicitud.</p><button className="primary-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></section></main>;
  }

  if (!profile || !course) {
    return <AuthScreen supabase={supabase} dark={dark} onToggleDark={toggleDark} message={authMessage} />;
  }

  return <StudentApp supabase={supabase} profile={profile} course={course} inviteCode={inviteCode} dark={dark} onToggleDark={toggleDark} onSignOut={() => void supabase.auth.signOut()} />;
}
