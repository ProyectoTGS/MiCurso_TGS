export const SUBJECTS = [
  'Historia',
  'Matemática',
  'Lengua y Literatura',
  'Biología',
  'Inglés',
  'Física',
  'Química',
] as const;

export type Subject = (typeof SUBJECTS)[number];
export type PublicationType = 'prueba' | 'tp';
export type UserRole = 'alumno' | 'admin';
export type HistoryAction = 'publicó' | 'editó' | 'borró' | 'restauró';

export type Course = {
  id: string;
  nombre: string;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  curso_id: string;
  role: UserRole;
  activo: boolean;
  created_at: string;
};

export type Publication = {
  id: string;
  curso_id: string;
  materia: Subject;
  tipo: PublicationType;
  titulo: string;
  fecha: string;
  nota: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  borrada: boolean;
};

export type ChangeValue = { anterior: unknown; nuevo: unknown };
export type HistoryChanges = Record<string, ChangeValue | Record<string, unknown>>;

export type HistoryEntry = {
  id: number;
  publicacion_id: string;
  curso_id: string;
  user_id: string;
  accion: HistoryAction;
  cambios: HistoryChanges;
  created_at: string;
};

export const SUBJECT_COLORS: Record<Subject, string> = {
  Historia: '#c99537',
  Matemática: '#df675c',
  'Lengua y Literatura': '#557fbd',
  Biología: '#4a9d79',
  Inglés: '#7d70cf',
  Física: '#4b98a2',
  Química: '#ad6b9e',
};

export const FIELD_LABELS: Record<string, string> = {
  materia: 'Materia',
  tipo: 'Tipo',
  titulo: 'Título',
  fecha: 'Fecha',
  nota: 'Nota',
  curso_id: 'Curso',
  borrada: 'Estado',
};

export function initials(username: string) {
  return username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'MC';
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const text = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function daysUntil(value: string) {
  const today = new Date(`${localDateKey()}T12:00:00`);
  const target = new Date(`${value}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(value: string) {
  const days = daysUntil(value);
  if (days < 0) return 'Fecha pasada';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `Faltan ${days} días`;
}

export function relativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'recién';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `ayer ${new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatChangeValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (field === 'fecha' && typeof value === 'string') return new Intl.DateTimeFormat('es-AR').format(new Date(`${value}T12:00:00`));
  if (field === 'tipo') return value === 'tp' ? 'TP' : 'Prueba';
  if (field === 'borrada') return value ? 'Borrada' : 'Activa';
  return String(value);
}

