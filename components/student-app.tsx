'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Home,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FIELD_LABELS,
  SUBJECT_COLORS,
  SUBJECTS,
  countdownLabel,
  dateLabel,
  daysUntil,
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

type View = 'board' | 'calendar' | 'history';
type Draft = { materia: Subject; tipo: PublicationType; titulo: string; fecha: string; nota: string };

const EMPTY_DRAFT: Draft = {
  materia: 'Historia',
  tipo: 'prueba',
  titulo: '',
  fecha: localDateKey(),
  nota: '',
};

function PublicationCard({ publication, profiles, onOpen }: { publication: Publication; profiles: Map<string, Profile>; onOpen: () => void }) {
  const days = daysUntil(publication.fecha);
  const urgency = days >= 0 && days < 2 ? 'urgent' : days >= 0 && days <= 7 ? 'soon' : '';
  const author = profiles.get(publication.created_by ?? '')?.username ?? 'Usuario eliminado';
  const editor = profiles.get(publication.updated_by ?? '')?.username;
  const edited = publication.updated_by !== publication.created_by;

  return (
    <button className={`publication-card ${days < 0 ? 'past' : ''} ${urgency}`} style={{ '--subject': SUBJECT_COLORS[publication.materia] } as React.CSSProperties} onClick={onOpen}>
      <span className="publication-subject"><i />{publication.materia}</span>
      <span className="publication-type">{publication.tipo === 'tp' ? 'TP' : 'Prueba'}</span>
      <strong>{publication.titulo}</strong>
      <span className="publication-date"><CalendarDays size={15} />{dateLabel(publication.fecha)}</span>
      <span className="publication-footer"><b><Clock3 size={14} />{countdownLabel(publication.fecha)}</b><small>Publicó {author}</small></span>
      {edited ? <span className="edited-by">Editado por {editor ?? 'Alumno'}</span> : null}
    </button>
  );
}

function ChangeDetails({ entry }: { entry: HistoryEntry }) {
  if (entry.accion !== 'editó') return null;
  const changes = Object.entries(entry.cambios).filter(([field, value]) => field !== 'publicacion' && value && typeof value === 'object' && 'anterior' in value && 'nuevo' in value);
  if (!changes.length) return null;
  return <ul className="change-list">{changes.map(([field, value]) => {
    const change = value as { anterior: unknown; nuevo: unknown };
    return <li key={field}><span>{FIELD_LABELS[field] ?? field}</span><del>{formatChangeValue(field, change.anterior)}</del><b>→</b><ins>{formatChangeValue(field, change.nuevo)}</ins></li>;
  })}</ul>;
}

function HistoryRow({ entry, publications, profiles }: { entry: HistoryEntry; publications: Map<string, Publication>; profiles: Map<string, Profile> }) {
  const publication = publications.get(entry.publicacion_id);
  const username = profiles.get(entry.user_id ?? '')?.username ?? 'Usuario eliminado';
  return (
    <article className="history-row" style={{ '--subject': publication ? SUBJECT_COLORS[publication.materia] : '#7b8496' } as React.CSSProperties}>
      <span className="history-avatar">{initials(username)}</span>
      <div>
        <div className="history-meta"><strong>{username}</strong><time>{relativeTime(entry.created_at)}</time></div>
        <p><b>{entry.accion.charAt(0).toUpperCase() + entry.accion.slice(1)}</b> {publication ? <>{publication.materia} · {publication.titulo}</> : 'una publicación'}</p>
        <ChangeDetails entry={entry} />
      </div>
    </article>
  );
}

function PublicationForm({ initial, busy, onClose, onSave }: { initial?: Publication; busy: boolean; onClose: () => void; onSave: (draft: Draft) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initial ? {
    materia: initial.materia,
    tipo: initial.tipo,
    titulo: initial.titulo,
    fecha: initial.fecha,
    nota: initial.nota ?? '',
  } : { ...EMPTY_DRAFT, fecha: localDateKey() });

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="publication-form-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Cerrar" />
      <section className="modal-card form-modal">
        <header><h2 id="publication-form-title">{initial ? 'Editar publicación' : 'Nueva publicación'}</h2><button onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
        <form onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
          <div className="form-grid">
            <label>Materia<select value={draft.materia} onChange={(event) => setDraft({ ...draft, materia: event.target.value as Subject })}>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label>Tipo<select value={draft.tipo} onChange={(event) => setDraft({ ...draft, tipo: event.target.value as PublicationType })}><option value="prueba">Prueba</option><option value="tp">TP</option></select></label>
          </div>
          <label>Título<input value={draft.titulo} onChange={(event) => setDraft({ ...draft, titulo: event.target.value })} maxLength={100} required /></label>
          <label>Fecha<input type="date" value={draft.fecha} onChange={(event) => setDraft({ ...draft, fecha: event.target.value })} required /></label>
          <label>Nota <small>Opcional</small><textarea value={draft.nota} onChange={(event) => setDraft({ ...draft, nota: event.target.value })} maxLength={240} rows={3} placeholder="Ej: Entra hasta la unidad 4" /></label>
          <button className="primary-button" disabled={busy || !draft.titulo.trim()}>{initial ? 'Guardar cambios' : 'Publicar'}</button>
        </form>
      </section>
    </div>
  );
}

function PublicationDetail({ publication, history, publications, profiles, isAdmin, busy, onClose, onEdit, onDelete }: {
  publication: Publication;
  history: HistoryEntry[];
  publications: Map<string, Publication>;
  profiles: Map<string, Profile>;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const author = profiles.get(publication.created_by ?? '')?.username ?? 'Usuario eliminado';
  const publicationHistory = history.filter((entry) => entry.publicacion_id === publication.id);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Cerrar" />
      <section className="modal-card detail-modal">
        <header><span className="detail-subject" style={{ '--subject': SUBJECT_COLORS[publication.materia] } as React.CSSProperties}><i />{publication.materia}</span><button onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
        <span className="publication-type">{publication.tipo === 'tp' ? 'TP' : 'Prueba'}</span>
        <h2 id="detail-title">{publication.titulo}</h2>
        <dl><div><dt>Fecha</dt><dd>{dateLabel(publication.fecha)} · {countdownLabel(publication.fecha)}</dd></div>{publication.nota ? <div><dt>Nota</dt><dd>{publication.nota}</dd></div> : null}<div><dt>Publicó</dt><dd>{author}</dd></div></dl>
        <div className="detail-actions"><button className="secondary-button" onClick={onEdit}><Pencil size={16} />Editar</button>{isAdmin ? <button className="danger-button" disabled={busy} onClick={onDelete}><Trash2 size={16} />Borrar</button> : null}</div>
        <section className="publication-history"><h3>Cambios</h3>{publicationHistory.length ? publicationHistory.map((entry) => <HistoryRow key={entry.id} entry={entry} publications={publications} profiles={profiles} />) : <p>Sin cambios registrados.</p>}</section>
      </section>
    </div>
  );
}

function CalendarView({ publications, profiles, onOpen }: { publications: Publication[]; profiles: Map<string, Profile>; onOpen: (publication: Publication) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const firstOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstOffset).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const monthPublications = publications.filter((publication) => {
    const date = new Date(`${publication.fecha}T12:00:00`);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });
  const byDay = monthPublications.reduce<Record<number, Publication[]>>((result, publication) => {
    const day = Number(publication.fecha.slice(8, 10));
    (result[day] ??= []).push(publication);
    return result;
  }, {});
  const selected = byDay[selectedDay] ?? [];

  function changeMonth(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
    setSelectedDay(1);
  }

  return (
    <section className="calendar-view">
      <div className="calendar-card">
        <div className="month-switch"><button onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button><strong>{new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(month)}</strong><button onClick={() => changeMonth(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button></div>
        <div className="weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">{cells.map((day, index) => day ? <button key={`${day}-${index}`} className={day === selectedDay ? 'selected' : ''} onClick={() => setSelectedDay(day)}><span>{day}</span><i>{(byDay[day] ?? []).slice(0, 3).map((publication) => <b key={publication.id} style={{ background: SUBJECT_COLORS[publication.materia] }} />)}</i></button> : <span key={`blank-${index}`} />)}</div>
      </div>
      <aside className="day-agenda"><h2>{selectedDay} de {new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(month)}</h2>{selected.length ? <div className="publication-list">{selected.map((publication) => <PublicationCard key={publication.id} publication={publication} profiles={profiles} onOpen={() => onOpen(publication)} />)}</div> : <p className="empty-message">Sin pruebas ni TPs.</p>}</aside>
    </section>
  );
}

export function StudentApp({ supabase, profile, course, inviteCode, dark, onToggleDark, onClassChanged, onSignOut }: {
  supabase: SupabaseClient;
  profile: Profile;
  course: Course;
  inviteCode: string | null;
  dark: boolean;
  onToggleDark: () => void;
  onClassChanged: () => void;
  onSignOut: () => void;
}) {
  const [view, setView] = useState<View>('board');
  const [publications, setPublications] = useState<Publication[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [joiningClass, setJoiningClass] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [classError, setClassError] = useState('');
  const [selected, setSelected] = useState<Publication | null>(null);
  const [editing, setEditing] = useState<Publication | null | 'new'>(null);
  const [historySubject, setHistorySubject] = useState<'Todas' | Subject>('Todas');
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    const [publicationResult, historyResult, profileResult] = await Promise.all([
      supabase.from('publicaciones').select('*').eq('curso_id', profile.curso_id).order('fecha', { ascending: true }),
      supabase.from('historial').select('*').eq('curso_id', profile.curso_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('curso_id', profile.curso_id),
    ]);
    if (!publicationResult.error) setPublications((publicationResult.data ?? []) as Publication[]);
    if (!historyResult.error) setHistory((historyResult.data ?? []) as HistoryEntry[]);
    if (!profileResult.error) setProfiles((profileResult.data ?? []) as Profile[]);
    setLoading(false);
  }, [profile.curso_id, supabase]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const channel = supabase.channel(`curso-${profile.curso_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publicaciones', filter: `curso_id=eq.${profile.curso_id}` }, () => void loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial', filter: `curso_id=eq.${profile.curso_id}` }, () => void loadData())
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [loadData, profile.curso_id, supabase]);

  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const publicationMap = useMemo(() => new Map(publications.map((item) => [item.id, item])), [publications]);
  const visiblePublications = useMemo(() => publications.filter((item) => !item.borrada), [publications]);
  const boardPublications = useMemo(() => [...visiblePublications].sort((a, b) => {
    const aPast = daysUntil(a.fecha) < 0;
    const bPast = daysUntil(b.fecha) < 0;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha);
  }), [visiblePublications]);
  const filteredHistory = historySubject === 'Todas' ? history : history.filter((entry) => publicationMap.get(entry.publicacion_id)?.materia === historySubject);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  async function joinClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setClassError('');
    const { error } = await supabase.rpc('unirse_clase', { codigo_clase: classCode.trim() });
    if (error) setClassError(error.message);
    else {
      setJoiningClass(false);
      setClassCode('');
      onClassChanged();
    }
    setBusy(false);
  }

  async function savePublication(draft: Draft) {
    if (busy) return;
    setBusy(true);
    if (editing === 'new') {
      const { error } = await supabase.from('publicaciones').insert({
        curso_id: profile.curso_id,
        materia: draft.materia,
        tipo: draft.tipo,
        titulo: draft.titulo.trim(),
        fecha: draft.fecha,
        nota: draft.nota.trim() || null,
        created_by: profile.id,
        updated_by: profile.id,
      });
      if (error) notify(error.message); else notify('Publicación creada.');
    } else if (editing) {
      const { error } = await supabase.from('publicaciones').update({ ...draft, titulo: draft.titulo.trim(), nota: draft.nota.trim() || null, updated_by: profile.id }).eq('id', editing.id);
      if (error) notify(error.message); else notify('Cambios guardados.');
    }
    await loadData();
    setEditing(null);
    setSelected(null);
    setBusy(false);
  }

  async function deletePublication() {
    if (!selected || profile.role !== 'admin' || busy) return;
    setBusy(true);
    const { error } = await supabase.from('publicaciones').update({ borrada: true, updated_by: profile.id }).eq('id', selected.id);
    if (error) notify(error.message); else notify('Publicación borrada.');
    await loadData();
    setSelected(null);
    setBusy(false);
  }

  return (
    <main className={`app-root ${dark ? 'dark' : ''}`}>
      <aside className="desktop-nav">
        <div className="brand"><span>MC</span><div><strong>Mi Curso</strong><small>{course.nombre}</small></div></div>
        <nav aria-label="Navegación"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Home size={19} />Tablón</button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={19} />Calendario</button><button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><History size={19} />Historial</button></nav>
        <button className="desktop-new" onClick={() => setEditing('new')}><Plus size={18} />Publicar</button>
      </aside>

      <section className="app-column">
        <header className="app-header">
          <div><h1>{course.nombre}</h1>{inviteCode ? <small>Código de clase: <strong>{inviteCode}</strong></small> : null}</div>
          <div className="header-buttons"><button className="theme-button" onClick={onToggleDark} aria-label={dark ? 'Usar modo claro' : 'Usar modo oscuro'}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><button className="user-button" onClick={() => setMenuOpen((current) => !current)} aria-label="Abrir menú de usuario">{initials(profile.username)}</button></div>
          {menuOpen ? <div className="user-menu"><strong>{profile.username}</strong><span>{course.nombre}</span>{profile.role === 'admin' ? <Link href="/admin"><Settings size={16} />Panel de control</Link> : null}{!profile.es_profesor && profile.role !== 'admin' ? <button onClick={() => { setMenuOpen(false); setClassError(''); setJoiningClass(true); }}>Cambiar de clase</button> : null}<button onClick={onSignOut}><LogOut size={16} />Cerrar sesión</button></div> : null}
        </header>

        <div className="content">
          {loading ? <div className="loading-state">Cargando…</div> : null}
          {!loading && view === 'board' ? <section className="board-view"><h2>Tablón</h2><div className="publication-list">{boardPublications.map((publication) => <PublicationCard key={publication.id} publication={publication} profiles={profileMap} onOpen={() => setSelected(publication)} />)}</div>{!boardPublications.length ? <p className="empty-message">No hay pruebas ni TPs publicados.</p> : null}</section> : null}
          {!loading && view === 'calendar' ? <><h2 className="mobile-view-title">Calendario</h2><CalendarView publications={visiblePublications} profiles={profileMap} onOpen={setSelected} /></> : null}
          {!loading && view === 'history' ? <section className="history-view"><div className="view-heading"><h2>Historial</h2><label>Materia<select value={historySubject} onChange={(event) => setHistorySubject(event.target.value as 'Todas' | Subject)}><option>Todas</option>{SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label></div><div className="history-list">{filteredHistory.map((entry) => <HistoryRow key={entry.id} entry={entry} publications={publicationMap} profiles={profileMap} />)}</div>{!filteredHistory.length ? <p className="empty-message">No hay cambios registrados.</p> : null}</section> : null}
        </div>
      </section>

      <button className="floating-add" onClick={() => setEditing('new')} aria-label="Publicar"><Plus size={27} /></button>
      <nav className="bottom-nav" aria-label="Navegación principal"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><Home size={21} /><span>Tablón</span></button><button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={21} /><span>Calendario</span></button><span /><button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><History size={21} /><span>Historial</span></button></nav>

      {joiningClass ? <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="join-class-title"><button className="modal-scrim" onClick={() => setJoiningClass(false)} aria-label="Cerrar" /><section className="modal-card form-modal"><header><h2 id="join-class-title">Cambiar de clase</h2><button onClick={() => setJoiningClass(false)} aria-label="Cerrar"><X size={20} /></button></header><p>Ingresá el código que te dio tu profesor. Dejarás de ver el tablón de tu clase actual.</p><form onSubmit={joinClass}><label>Código de clase<input value={classCode} onChange={(event) => setClassCode(event.target.value.toUpperCase())} maxLength={12} required /></label>{classError ? <p className="form-feedback" role="status">{classError}</p> : null}<button className="primary-button" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar a la clase'}</button></form></section></div> : null}
      {editing ? <PublicationForm initial={editing === 'new' ? undefined : editing} busy={busy} onClose={() => setEditing(null)} onSave={savePublication} /> : null}
      {selected ? <PublicationDetail publication={selected} history={history} publications={publicationMap} profiles={profileMap} isAdmin={profile.role === 'admin'} busy={busy} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={deletePublication} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}

