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
      // Verificar actualizaciones cada 30 minutos
      setInterval(() => {
        r.update();
      }, 30 * 60 * 1000);

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
