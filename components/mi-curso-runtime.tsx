'use client';

import { BookOpen, Database, GraduationCap, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/auth-screen';
import { StudentApp } from '@/components/student-app';
import { useAccount } from '@/lib/use-account';

/**
 * The complete Mi Curso experience exposed as a reusable component.
 * Plasmic registers this component in its app host, while the regular
 * homepage keeps rendering the exact same runtime.
 */
export function MiCursoRuntime() {
  const { supabase, loading, userId, email, profile, course, inviteCode, error, reload } = useAccount();
  const needsProfile = !profile ? userId : null;
  const [dark, setDark] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [username, setUsername] = useState('');
  const [teacher, setTeacher] = useState(false);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const themeLoad = window.setTimeout(() => setDark(localStorage.getItem('mi-curso-theme') === 'dark'), 0);
    return () => window.clearTimeout(themeLoad);
  }, []);

  useEffect(() => {
    if (!loading && profile?.activo && profile.role === 'admin') window.location.replace('/admin');
  }, [loading, profile]);

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
      await reload();
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
    else await reload();
    setSaving(false);
  }

  if (!supabase) {
    return <main className={`setup-page ${dark ? 'dark' : ''}`}><section><Database size={30} /><h1>Configurar Supabase</h1><p>Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.</p></section></main>;
  }

  if (loading || (profile?.activo && profile.role === 'admin')) {
    return <main className={`loading-page ${dark ? 'dark' : ''}`}><LoaderCircle className="spin" size={28} /><span>Cargando</span></main>;
  }

  if (error) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><p role="alert">{error}</p><button className="primary-button" onClick={() => void reload()}>Reintentar</button><button className="google-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></section></main>;
  }

  if (needsProfile) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Completá tu perfil</h1><p>Elegí un nombre de usuario y el tipo de cuenta para continuar.</p><p className="account-email">{email}</p><form onSubmit={completeProfile}>
      <label>Nombre de usuario<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={40} autoComplete="nickname" required /></label>
      <label>Tipo de cuenta<select value={teacher ? 'profesor' : 'alumno'} onChange={(event) => setTeacher(event.target.value === 'profesor')}><option value="alumno">Soy alumno</option><option value="profesor">Soy profesor</option></select></label>
      {authMessage ? <p className="form-feedback" role="status">{authMessage}</p> : null}
      <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Continuar'}</button>
      <button type="button" className="google-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
    </form></section></main>;
  }

  if (profile?.activo && !profile.curso_id) {
    const isTeacher = profile.es_profesor;
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card" aria-labelledby="class-title">
      <div className="auth-brand"><span>{isTeacher ? <GraduationCap size={24} /> : <BookOpen size={24} />}</span><strong>Mi Curso · {isTeacher ? 'Profesor' : 'Alumno'}</strong></div>
      <h1 id="class-title">{isTeacher ? 'Crear una clase' : 'Entrar a una clase'}</h1>
      <p>{isTeacher ? 'Elegí el nombre de tu clase. Después vas a recibir un código para compartir con tus alumnos.' : 'Pedile el código a tu profesor e ingresalo para participar en el tablón de tu clase.'}</p>
      <p className="account-email">{email}</p>
      <form onSubmit={(event) => void handleClass(event, isTeacher ? 'create' : 'join')}>
        {isTeacher
          ? <label>Nombre de la clase<input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Por ejemplo: Historia de 6° A" minLength={2} maxLength={40} required /></label>
          : <label>Código de clase<input value={classCode} onChange={(event) => setClassCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="Código de 5 dígitos" autoComplete="off" inputMode="numeric" pattern="[0-9]{5}" spellCheck={false} minLength={5} maxLength={5} required /></label>}
        {authMessage ? <p className="form-feedback" role="status">{authMessage}</p> : null}
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : isTeacher ? 'Crear una clase' : 'Entrar a la clase'}</button>
        <button type="button" className="google-button" onClick={() => void supabase.auth.signOut()}>Cambiar de cuenta</button>
      </form>
    </section></main>;
  }

  if (profile && !profile.activo) {
    return <main className={`auth-page ${dark ? 'dark' : ''}`}><section className="auth-card"><h1>Cuenta desactivada</h1><p>Un administrador desactivó esta cuenta. Contactalo para recuperar el acceso.</p><button className="primary-button" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button></section></main>;
  }

  if (!profile || !course) {
    return <AuthScreen supabase={supabase} dark={dark} onToggleDark={toggleDark} message={authMessage} />;
  }

  return <StudentApp key={profile.id + ':' + course.id} supabase={supabase} profile={profile} course={course} inviteCode={inviteCode} dark={dark} onToggleDark={toggleDark} onClassChanged={() => void reload()} onSignOut={() => void supabase.auth.signOut()} />;
}
