import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { MessageProvider } from './context/MessageContext'
import { registerSW } from 'virtual:pwa-register'

// Registro del Service Worker con actualización automática
const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      // Verificar actualizaciones cada 3 minutos para mayor frescura
      setInterval(() => {
        r.update();
      }, 3 * 60 * 1000);

      // Verificar actualizaciones cuando la pestaña recupera el foco
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          r.update();
        }
      });
    }
  },
  onNeedRefresh() {
    // Si registerType es 'autoUpdate', esto se llama y el plugin refresca solo.
    // Pero si queremos forzarlo o registrar el evento:
    console.log('Nueva versión detectada, actualizando...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App lista para uso offline');
  }
})

// === PROTECTOR DE FUENTES (Evita ver texto en lugar de íconos) ===
// Detectar cuando la fuente de iconos esté lista para mostrar la app
if ('fonts' in document) {
  // Intentar cargar la familia de íconos explícitamente
  document.fonts.load('24px "Material Symbols Outlined"').then(() => {
    document.documentElement.classList.add('fonts-active');
  }).catch(() => {
    // Fallback por si falla o tarda demasiado (3 segundos)
    setTimeout(() => document.documentElement.classList.add('fonts-active'), 3000);
  });

  // También escuchar cuando todas las fuentes del documento estén listas
  document.fonts.ready.then(() => {
    document.documentElement.classList.add('fonts-active');
  });
} else {
  // Fallback para navegadores antiguos
  document.documentElement.classList.add('fonts-active');
}



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotificationProvider>
      <AuthProvider>
        <MessageProvider>
          <App />
        </MessageProvider>
      </AuthProvider>
    </NotificationProvider>
  </StrictMode>,
)
