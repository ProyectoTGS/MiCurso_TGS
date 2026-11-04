'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Activity,
  BookOpen,
  CalendarDays,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FIELD_LABELS,
  SUBJECTS,
  formatChangeValue,
  initials,
  localDateKey,
  relativeTime,
  type Course,
  type HistoryEntry,
  type Profile,
  type Publication,
  type PublicationType,
  type Subject,
} from '@/lib/mi-curso';

type AdminSection = 'overview' | 'users' | 'posts' | 'courses' | 'history';

const SECTION_TITLES: Record<AdminSection, string> = {
  overview: 'Resumen',
  users: 'Usuarios',
  posts: 'Tablón',
  courses: 'Cursos',
  history: 'Historial',
};

function AdminPostEditor({
  publication,
  courses,
  busy,
  onClose,
  onSave,
}: {
  publication: Publication;
  courses: Course[];
  busy: boolean;
  onClose: () => void;
  onSave: (publication: Publication) => void;
}) {
  const [draft, setDraft] = useState(publication);

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Cerrar" />
      <section className="modal-card form-modal">
        <header>
          <h2 id="admin-edit-title">Editar publicación</h2>
          <button onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <form onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
          <label>
            Curso
            <select value={draft.curso_id} onChange={(event) => setDraft({ ...draft, curso_id: event.target.value })}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.nombre}</option>)}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Materia
              <select value={draft.materia} onChange={(event) => setDraft({ ...draft, materia: event.target.value as Subject })}>
                {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
              </select>
            </label>
            <label>
              Tipo
              <select value={draft.tipo} onChange={(event) => setDraft({ ...draft, tipo: event.target.value as PublicationType })}>
                <option value="prueba">Prueba</option>
                <option value="tp">TP</option>
              </select>
            </label>
          </div>
          <label>Título<input value={draft.titulo} onChange={(event) => setDraft({ ...draft, titulo: event.target.value })} required /></label>
          <label>Fecha<input type="date" value={draft.fecha} onChange={(event) => setDraft({ ...draft, fecha: event.target.value })} required /></label>
          <label>Nota<textarea value={draft.nota ?? ''} onChange={(event) => setDraft({ ...draft, nota: event.target.value || null })} rows={3} /></label>
          <button className="primary-button" disabled={busy}>Guardar cambios</button>
        </form>
      </section>
    </div>
  );
}

export function AdminPanel({ supabase, admin }: { supabase: SupabaseClient; admin: Profile }) {
  const [section, setSection] = useState<AdminSection>('posts');
  const [courses, setCourses] = useState<Course[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('Todos');
  const [subjectFilter, setSubjectFilter] = useState<'Todas' | Subject>('Todas');
  const [userFilter, setUserFilter] = useState('Todos');
  const [newCourse, setNewCourse] = useState('');
  const [editingPost, setEditingPost] = useState<Publication | null>(null);
  const [toast, setToast] = useState('');

  const loadAll = useCallback(async () => {
    const [courseResult, profileResult, publicationResult, historyResult] = await Promise.all([
      supabase.from('cursos').select('*').order('nombre'),
      supabase.from('profiles').select('*').order('username'),
      supabase.from('publicaciones').select('*').order('fecha'),
      supabase.from('historial').select('*').order('created_at', { ascending: false }),
    ]);
    if (!courseResult.error) setCourses((courseResult.data ?? []) as Course[]);
    if (!profileResult.error) setProfiles((profileResult.data ?? []) as Profile[]);
    if (!publicationResult.error) setPublications((publicationResult.data ?? []) as Publication[]);
    if (!historyResult.error) setHistory((historyResult.data ?? []) as HistoryEntry[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      setDark(localStorage.getItem('mi-curso-theme') === 'dark');
      void loadAll();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAll]);

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const publicationMap = useMemo(() => new Map(publications.map((publication) => [publication.id, publication])), [publications]);
  const filteredProfiles = profiles.filter((profile) => profile.username.toLowerCase().includes(search.toLowerCase()));
  const filteredPublications = publications.filter((publication) =>
    (courseFilter === 'Todos' || publication.curso_id === courseFilter)
    && (subjectFilter === 'Todas' || publication.materia === subjectFilter));
  const filteredHistory = history.filter((entry) => {
    const publication = publicationMap.get(entry.publicacion_id);
    return (courseFilter === 'Todos' || entry.curso_id === courseFilter)
      && (userFilter === 'Todos' || entry.user_id === userFilter)
      && (subjectFilter === 'Todas' || publication?.materia === subjectFilter);
  });

  const activeProfiles = profiles.filter((profile) => profile.activo).length;
  const inactiveProfiles = profiles.length - activeProfiles;
  const activePublications = publications.filter((publication) => !publication.borrada).length;
  const nextSevenDays = publications.filter((publication) => {
    if (publication.borrada || publication.fecha < localDateKey()) return false;
    const days = Math.round((new Date(`${publication.fecha}T12:00:00`).getTime() - new Date(`${localDateKey()}T12:00:00`).getTime()) / 86_400_000);
    return days <= 7;
  }).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function toggleDark() {
    setDark((current) => {
      const next = !current;
      localStorage.setItem('mi-curso-theme', next ? 'dark' : 'light');
      return next;
    });
  }

  async function saveUser(profile: Profile) {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      username: profile.username.trim(),
      curso_id: profile.curso_id,
      activo: profile.activo,
    }).eq('id', profile.id);
    if (error) notify(error.message); else notify('Usuario actualizado.');
    await loadAll();
    setBusy(false);
  }

  async function deleteUser(profile: Profile) {
    if (!window.confirm(`¿Eliminar la cuenta de ${profile.username}? No se puede deshacer. Las publicaciones del curso se conservarán sin identificar a la cuenta.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_user', { target_id: profile.id });
    if (error) notify(error.message); else notify('Cuenta eliminada.');
    await loadAll();
    setBusy(false);
  }

  async function deleteHistory(entry: HistoryEntry) {
    if (!window.confirm('¿Eliminar este registro del historial? Esta acción no se puede deshacer.')) return;
    setBusy(true);
    const { data, error } = await supabase.from('historial').delete().eq('id', entry.id).select('id');
    if (error || !data?.length) notify(error?.message ?? 'No se pudo eliminar el registro.'); else notify('Registro eliminado.');
    await loadAll();
    setBusy(false);
  }

  async function deletePostPermanently(publication: Publication) {
    if (!window.confirm(`¿Eliminar definitivamente «${publication.titulo}» y su historial? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    const { data, error } = await supabase.from('publicaciones').delete().eq('id', publication.id).select('id');
    if (error || !data?.length) notify(error?.message ?? 'No se pudo eliminar la publicación.'); else notify('Publicación eliminada definitivamente.');
    await loadAll();
    setBusy(false);
  }

  async function createCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!newCourse.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('cursos').insert({ nombre: newCourse.trim() });
    if (error) notify(error.message);
    else {
      setNewCourse('');
      notify('Curso creado.');
    }
    await loadAll();
    setBusy(false);
  }

  async function saveCourse(course: Course) {
    setBusy(true);
    const { error } = await supabase.from('cursos').update({ nombre: course.nombre.trim() }).eq('id', course.id);
    if (error) notify(error.message); else notify('Curso actualizado.');
    await loadAll();
    setBusy(false);
  }

  async function setDeleted(publication: Publication, borrada: boolean) {
    setBusy(true);
    const { error } = await supabase.from('publicaciones').update({ borrada, updated_by: admin.id }).eq('id', publication.id);
    if (error) notify(error.message); else notify(borrada ? 'Publicación borrada.' : 'Publicación restaurada.');
    await loadAll();
    setBusy(false);
  }

  async function savePost(publication: Publication) {
    setBusy(true);
    const { error } = await supabase.from('publicaciones').update({
      curso_id: publication.curso_id,
      materia: publication.materia,
      tipo: publication.tipo,
      titulo: publication.titulo.trim(),
      fecha: publication.fecha,
      nota: publication.nota || null,
      updated_by: admin.id,
    }).eq('id', publication.id);
    if (error) notify(error.message); else notify('Publicación actualizada.');
    await loadAll();
    setEditingPost(null);
    setBusy(false);
  }

  const navigation = [
    { id: 'posts' as const, label: 'Tablón', icon: Home },
    { id: 'overview' as const, label: 'Resumen', icon: LayoutDashboard },
    { id: 'users' as const, label: 'Usuarios', icon: Users },
    { id: 'courses' as const, label: 'Cursos', icon: GraduationCap },
    { id: 'history' as const, label: 'Historial', icon: History },
  ];

  return (
    <main className={`admin-page ${dark ? 'dark' : ''}`}>
      <aside className="admin-sidebar">
        <div className="brand admin-brand">
          <span><ShieldCheck size={20} /></span>
          <div><strong>Mi Curso Admin</strong><small>Control general</small></div>
        </div>
        <nav aria-label="Administración">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}><Icon size={18} />{item.label}</button>;
          })}
        </nav>
        <div className="admin-identity"><span>{initials(admin.username)}</span><div><strong>{admin.username}</strong><small>Administrador principal</small></div></div>
        <button className="admin-signout" onClick={() => void supabase.auth.signOut().then(() => { window.location.href = '/'; })}><LogOut size={17} />Cerrar sesión</button>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div><span>Panel administrativo</span><h1>{SECTION_TITLES[section]}</h1></div>
          <button className="theme-button" onClick={toggleDark} aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
        </header>

        {loading ? <div className="admin-loading"><Activity className="spin" size={22} />Cargando información…</div> : null}

        {!loading && section === 'overview' ? (
          <div className="admin-overview">
            <section className="admin-hero">
              <div><span>Acceso maestro</span><h2>Todo el curso, en un solo lugar.</h2><p>Administrá cuentas, contenido y cursos desde este panel independiente.</p></div>
              <ShieldCheck size={76} aria-hidden="true" />
            </section>
            <div className="admin-stats">
              <button onClick={() => setSection('users')}><span><UserCheck size={18} /></span><strong>{activeProfiles}</strong><small>usuarios activos</small></button>
              <button onClick={() => setSection('users')}><span><UserX size={18} /></span><strong>{inactiveProfiles}</strong><small>usuarios desactivados</small></button>
              <button onClick={() => setSection('courses')}><span><GraduationCap size={18} /></span><strong>{courses.length}</strong><small>cursos</small></button>
              <button onClick={() => setSection('posts')}><span><BookOpen size={18} /></span><strong>{activePublications}</strong><small>publicaciones activas</small></button>
              <button onClick={() => setSection('posts')}><span><CalendarDays size={18} /></span><strong>{nextSevenDays}</strong><small>fechas esta semana</small></button>
            </div>
            <div className="admin-overview-grid">
              <section className="admin-overview-card">
                <header><div><span>Actividad</span><h3>Últimos cambios</h3></div><button onClick={() => setSection('history')}>Ver historial</button></header>
                <div className="admin-recent-list">
                  {history.slice(0, 6).map((entry) => {
                    const publication = publicationMap.get(entry.publicacion_id);
                    return <article key={entry.id}><span>{initials(profileMap.get(entry.user_id ?? '')?.username ?? 'Usuario')}</span><div><strong>{profileMap.get(entry.user_id ?? '')?.username ?? 'Usuario eliminado'} {entry.accion}</strong><small>{publication?.titulo ?? 'Publicación'} · {courseMap.get(entry.curso_id)?.nombre}</small></div><time>{relativeTime(entry.created_at)}</time></article>;
                  })}
                  {!history.length ? <p className="admin-empty">Todavía no hay actividad.</p> : null}
                </div>
              </section>
              <section className="admin-overview-card admin-quick-actions">
                <header><div><span>Accesos</span><h3>Gestión rápida</h3></div></header>
                <button onClick={() => setSection('users')}><Users size={18} /><span><strong>Administrar usuarios</strong><small>Cambiar curso o estado</small></span></button>
                <button onClick={() => setSection('posts')}><BookOpen size={18} /><span><strong>Revisar publicaciones</strong><small>Editar, borrar o restaurar</small></span></button>
                <button onClick={() => setSection('courses')}><GraduationCap size={18} /><span><strong>Organizar cursos</strong><small>Crear y cambiar nombres</small></span></button>
              </section>
            </div>
          </div>
        ) : null}

        {!loading && section === 'users' ? (
          <>
            <div className="admin-section-tools"><label className="admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar usuario" /></label><span>{filteredProfiles.length} usuarios · {inactiveProfiles} sin acceso</span></div>
            <div className="admin-list">
              {filteredProfiles.map((profile) => (
                <div className="admin-user-row" key={profile.id}>
                  <span className="admin-user-avatar">{initials(profile.username)}</span>
                  <input aria-label="Nombre de usuario" value={profile.username} onChange={(event) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, username: event.target.value } : item))} />
                  <select aria-label="Curso" value={profile.curso_id} onChange={(event) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, curso_id: event.target.value } : item))}>{courses.map((course) => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select>
                  <label className="active-check"><input type="checkbox" checked={profile.activo} disabled={profile.id === admin.id} onChange={(event) => setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, activo: event.target.checked } : item))} />{profile.activo ? 'Acceso habilitado' : 'Aprobar acceso'}</label>
                  <button className="secondary-button" disabled={busy} onClick={() => saveUser(profile)}>Guardar</button>
                  {profile.role !== 'admin' ? <button className="danger-button" disabled={busy} onClick={() => deleteUser(profile)} aria-label={`Eliminar cuenta de ${profile.username}`}><Trash2 size={17} /> Eliminar</button> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {!loading && section === 'posts' ? (
          <>
            <div className="admin-filters"><label>Curso<select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option>Todos</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select></label><label>Materia<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as 'Todas' | Subject)}><option>Todas</option>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label></div>
            <div className="admin-list admin-board-list">
              {filteredPublications.map((publication) => <article className={`admin-post-row ${publication.borrada ? 'deleted' : ''}`} key={publication.id}><div><strong>{publication.titulo}</strong><span>{courseMap.get(publication.curso_id)?.nombre} · {publication.materia} · {publication.tipo === 'tp' ? 'TP' : 'Prueba'}{publication.borrada ? ' · Borrada' : ''}</span></div><button onClick={() => setEditingPost(publication)} aria-label="Editar"><Pencil size={17} /></button>{publication.borrada ? <><button onClick={() => setDeleted(publication, false)} aria-label="Restaurar"><RotateCcw size={17} /></button><button className="delete-icon" disabled={busy} onClick={() => deletePostPermanently(publication)} aria-label="Eliminar definitivamente"><Trash2 size={17} /></button></> : <button className="delete-icon" onClick={() => setDeleted(publication, true)} aria-label="Borrar"><Trash2 size={17} /></button>}</article>)}
              {!filteredPublications.length ? <p className="admin-empty">No hay publicaciones con estos filtros.</p> : null}
            </div>
          </>
        ) : null}

        {!loading && section === 'courses' ? (
          <>
            <form className="new-course-form" onSubmit={createCourse}><input value={newCourse} onChange={(event) => setNewCourse(event.target.value)} placeholder="Ej: 6° A" /><button className="primary-button" disabled={busy}><Plus size={17} />Crear curso</button></form>
            <div className="admin-list admin-course-list">{courses.map((course) => <div className="admin-course-row" key={course.id}><span><GraduationCap size={18} /></span><input value={course.nombre} onChange={(event) => setCourses((current) => current.map((item) => item.id === course.id ? { ...item, nombre: event.target.value } : item))} /><small>{profiles.filter((profile) => profile.curso_id === course.id).length} alumnos</small><button className="secondary-button" disabled={busy} onClick={() => saveCourse(course)}>Guardar</button></div>)}</div>
          </>
        ) : null}

        {!loading && section === 'history' ? (
          <>
            <div className="admin-filters"><label>Curso<select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option>Todos</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select></label><label>Usuario<select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}><option>Todos</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.username}</option>)}</select></label><label>Materia<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as 'Todas' | Subject)}><option>Todas</option>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label></div>
            <div className="admin-history">{filteredHistory.map((entry) => { const publication = publicationMap.get(entry.publicacion_id); return <article key={entry.id}><div><strong>{profileMap.get(entry.user_id ?? '')?.username ?? 'Usuario eliminado'} · {entry.accion}</strong><time>{relativeTime(entry.created_at)}</time></div><p>{courseMap.get(entry.curso_id)?.nombre} · {publication?.materia} · {publication?.titulo}</p>{entry.accion === 'editó' ? <ul>{Object.entries(entry.cambios).filter(([field, value]) => field !== 'publicacion' && value && typeof value === 'object' && 'anterior' in value && 'nuevo' in value).map(([field, value]) => { const change = value as { anterior: unknown; nuevo: unknown }; return <li key={field}>{FIELD_LABELS[field] ?? field}: {formatChangeValue(field, change.anterior)} → {formatChangeValue(field, change.nuevo)}</li>; })}</ul> : null}<button className="danger-button" disabled={busy} onClick={() => deleteHistory(entry)}><Trash2 size={16} /> Eliminar registro</button></article>; })}{!filteredHistory.length ? <p className="admin-empty">No hay cambios con estos filtros.</p> : null}</div>
          </>
        ) : null}
      </section>

      {editingPost ? <AdminPostEditor publication={editingPost} courses={courses} busy={busy} onClose={() => setEditingPost(null)} onSave={savePost} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
