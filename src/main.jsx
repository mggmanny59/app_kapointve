import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { MessageProvider } from './context/MessageContext'
import { registerSW } from 'virtual:pwa-register'

// Registro del Service Worker para PWA
// Se configura para verificar actualizaciones frecuentemente
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Al detectar una nueva versión, forzamos recarga tras confirmación o de forma automática
    // dependiendo de la criticidad. Aquí lo hacemos proactivo para móviles.
    if (confirm('Hay una nueva actualización disponible. ¿Deseas refrescar la aplicación para aplicar los cambios?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Aplicación lista para trabajar sin conexión.');
  },
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
