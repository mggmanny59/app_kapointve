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
      // Verificar actualizaciones del SW cada 3 minutos
      setInterval(() => {
        console.log('Buscando actualizaciones de Service Worker...');
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
    console.log('Nueva versión detectada. Recargando aplicación para aplicar cambios...');
    // Forzar recarga inmediata para asegurar que el usuario tenga el fix de iconos
    window.location.reload();
  },
  onOfflineReady() {
    console.log('App lista para uso offline');
  }
})

// === MECANISMO DE ACTUALIZACIÓN PROACTIVA ===
const CURRENT_VERSION = '1.0.6';
const checkForUpdates = async () => {
    try {
        const response = await fetch('/version.json?t=' + Date.now());
        const data = await response.json();
        if (data.version && data.version !== CURRENT_VERSION) {
            console.log(`Nueva versión disponible: ${data.version}. Actualizando...`);
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.update();
                }
            }
            window.location.reload();
        }
    } catch (err) {
        console.warn('No se pudo verificar la versión remota:', err);
    }
};

// Verificar versión cada 5 minutos
setInterval(checkForUpdates, 5 * 60 * 1000);
// Y al cargar
checkForUpdates();


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
