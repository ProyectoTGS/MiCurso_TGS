'use client';

import { BookOpen, Eye, EyeOff, LoaderCircle, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Course } from '@/lib/mi-curso';

type AuthMode = 'login' | 'register';

export function AuthScreen({
  supabase,
  courses,
  dark,
  onToggleDark,
  message,
}: {
  supabase: SupabaseClient;
  courses: Course[];
  dark: boolean;
  onToggleDark: () => void;
  message?: string;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(message ?? '');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setFeedback(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
      setBusy(false);
      return;
    }

    if (!username.trim() || !courseId) {
      setFeedback('Completá el nombre de usuario y el curso.');
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim(), curso_id: courseId } },
    });

    if (error) {
      setFeedback(error.message);
    } else if (!data.session) {
      setFeedback('Revisá tu email para confirmar la cuenta.');
    }
    setBusy(false);
  }

  function changeMode(next: AuthMode) {
    setMode(next);
    setFeedback('');
  }

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setFeedback('No se pudo iniciar sesión con Google. Intentá de nuevo.');
      setBusy(false);
    }
  }

  return (
    <main className={`auth-page ${dark ? 'dark' : ''}`}>
      <button className="theme-button auth-theme" onClick={onToggleDark} aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'}>
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span><BookOpen size={24} /></span><strong>Mi Curso</strong></div>
        <h1 id="auth-title">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <div className="auth-tabs" role="tablist" aria-label="Acceso">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Ingresar</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Registrarme</button>
        </div>
        <button type="button" className="google-button" disabled={busy} onClick={signInWithGoogle}><span aria-hidden="true">G</span> Continuar con Google</button>
        <div className="auth-divider">o con email</div>
        <form onSubmit={submit}>
          {mode === 'register' ? <>
            <label>Nombre de usuario<input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} autoComplete="nickname" required /></label>
            <label>Curso<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="">Elegí un curso</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select></label>
          </> : null}
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Contraseña<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {feedback ? <p className="form-feedback" role="status">{feedback}</p> : null}
          <button className="primary-button" disabled={busy || (mode === 'register' && !courses.length)}>{busy ? <LoaderCircle className="spin" size={18} /> : null}{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        </form>
      </section>
    </main>
  );
}

