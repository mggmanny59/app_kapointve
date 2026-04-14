/**
 * Logger seguro para producción.
 * En modo producción, suprime todos los logs para evitar
 * exponer datos sensibles en la consola del navegador.
 * 
 * SECURITY FIX M-01: Reemplaza console.log/error en toda la app.
 */
const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args) => isDev && console.log(...args),
    error: (...args) => isDev && console.error(...args),
    warn: (...args) => isDev && console.warn(...args),
    info: (...args) => isDev && console.info(...args),
};

export default logger;
