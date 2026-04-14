/**
 * Mapeo seguro de errores para producción.
 * Evita exponer mensajes internos de Supabase/sistema al usuario final.
 * 
 * SECURITY FIX M-04: Mensajes genéricos que no revelan estructura interna.
 */

const ERROR_MAP = [
    { match: 'invalid login credentials', message: 'Email o contraseña incorrectos.' },
    { match: 'email not confirmed', message: 'Tu cuenta no ha sido verificada. Revisa tu correo.' },
    { match: 'user already registered', message: 'Este correo ya está registrado.' },
    { match: 'duplicate key', message: 'Este registro ya existe en el sistema.' },
    { match: 'rate limit', message: 'Demasiados intentos. Intenta en unos minutos.' },
    { match: 'jwt expired', message: 'Tu sesión ha expirado. Inicia sesión nuevamente.' },
    { match: 'refresh_token', message: 'Tu sesión ha expirado. Inicia sesión nuevamente.' },
    { match: 'password', message: 'La contraseña no cumple con los requisitos mínimos.' },
    { match: 'permission denied', message: 'No tienes permisos para realizar esta acción.' },
    { match: 'row-level security', message: 'No tienes permisos para acceder a este recurso.' },
    { match: 'network', message: 'Error de conexión. Verifica tu internet e intenta de nuevo.' },
    { match: 'fetch', message: 'Error de conexión. Verifica tu internet e intenta de nuevo.' },
    { match: 'status_blocked', message: 'Tu cuenta ha sido bloqueada. Contacta soporte técnico.' },
    { match: 'status_pending', message: 'Tu cuenta está en proceso de revisión.' },
];

/**
 * Convierte un error técnico a un mensaje seguro para el usuario.
 * @param {Error|string|object} err - El error capturado
 * @returns {string} Mensaje seguro para mostrar al usuario
 */
export function getSafeErrorMessage(err) {
    const rawMessage = (err?.message || err?.error || String(err || '')).toLowerCase();

    for (const { match, message } of ERROR_MAP) {
        if (rawMessage.includes(match)) {
            return message;
        }
    }

    return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

export default getSafeErrorMessage;
