// Reglas puras de la confirmacion por correo (invitacion, recuperacion).
//
// Por que existe un paso intermedio: el enlace del correo se puede usar una
// sola vez, y Gmail, Outlook, los antivirus y las vistas previas de WhatsApp
// suelen abrir los enlaces por su cuenta para revisarlos. Si abrir el enlace
// bastara para validarlo, esos escaneos lo gastarian antes que la persona. Por
// eso el enlace solo muestra una pagina con un boton, y la validacion ocurre
// al tocarlo (POST), algo que un escaner no hace.

export const CONFIRM_PAGE_PATH = '/auth/confirm';
export const CONFIRM_API_PATH = '/api/auth/confirm';
export const CONFIRM_FAILURE_PATH = '/login?error=invite';

export const CONFIRM_TYPES = ['invite', 'recovery', 'signup', 'email'] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export interface ConfirmRequest {
  tokenHash: string;
  type: ConfirmType;
  next: string;
}

// Un token de Supabase mide unas decenas de caracteres; el tope solo evita
// basura enorme.
const MAX_TOKEN_LENGTH = 512;

export const isConfirmType = (value: unknown): value is ConfirmType =>
  typeof value === 'string' && (CONFIRM_TYPES as readonly string[]).includes(value);

// Solo se permite volver a una ruta interna. `//sitio` y `/\sitio` los
// navegadores los tratan como otro dominio, asi que se rechazan.
export const sanitizeNext = (raw: string | null | undefined): string => {
  const value = raw || '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
};

export const parseConfirmRequest = (
  read: (name: string) => string | null | undefined
): ConfirmRequest | null => {
  const tokenHash = (read('token_hash') || '').trim();
  const type = read('type');

  if (!tokenHash || tokenHash.length > MAX_TOKEN_LENGTH) return null;
  if (!isConfirmType(type)) return null;

  return { tokenHash, type, next: sanitizeNext(read('next')) };
};

// Texto del boton segun para que sirve el enlace.
export const confirmCopy = (type: ConfirmType): { title: string; text: string; button: string } => {
  if (type === 'invite' || type === 'signup') {
    return {
      title: 'Bienvenido',
      text: 'Toca el boton para crear tu clave y entrar a tu espacio.',
      button: 'Crear mi clave'
    };
  }
  return {
    title: 'Cambiar clave',
    text: 'Toca el boton para continuar y elegir tu nueva clave.',
    button: 'Continuar'
  };
};
