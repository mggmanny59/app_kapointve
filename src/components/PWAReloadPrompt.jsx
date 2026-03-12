import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';
// Iconos reemplazados por SVGs directos para evitar problemas de compilación con PWA


function PWAReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Verificar actualizaciones periódicamente (cada 30 minutos)
        setInterval(() => {
          r.update();
        }, 30 * 60 * 1000);

        // Verificar actualizaciones cuando la pestaña recupera el foco / vuelve del fondo
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            r.update();
          }
        });
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-[calc(100vw-32px)] w-96">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="p-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${needRefresh ? 'bg-orange-100' : 'bg-green-100'}`}>
              {needRefresh ? (
                <svg className={`w-5 h-5 text-orange-600 ${needRefresh ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  <path d="M21 3v9h-9" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
            </div>
            
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900">
                {needRefresh ? '¡Nueva versión disponible!' : 'Lista para usar offline'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {needRefresh 
                  ? 'Hay cambios importantes. Actualiza para disfrutar de las últimas mejoras y correcciones.' 
                  : 'La aplicación se ha guardado para funcionar sin conexión.'}
              </p>
            </div>

            <button 
              onClick={close}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {needRefresh && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all active:scale-95 shadow-sm"
              >
                Actualizar Ahora
              </button>
              <button
                onClick={close}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg transition-all"
              >
                Más Tarde
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PWAReloadPrompt;
