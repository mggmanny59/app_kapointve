# 📋 Backlog de Funcionalidades Pendientes (KPoint)

Este documento registra las ideas y funcionalidades conversadas que se han decidido postergar para una fase futura del desarrollo.

---

### 1. Autenticación con Google (OAuth)
*   **Estado:** Diseño y lógica base listos (ver manual).
*   **Descripción:** Permitir que clientes y dueños de negocio accedan usando sus credenciales de Google.
*   **Tareas Pendientes:**
    *   Habilitar el proveedor "Google" en el Dashboard de Supabase.
    *   Configurar el Client ID y Client Secret en Google Cloud Console.
    *   Restaurar el botón de Google en `Login.jsx` y la función `signInWithGoogle` en `AuthContext.jsx`.

---

### 2. Optimización de Carga de Imágenes (Marketing Hub)
*   **Estado:** Planeado.
*   **Descripción:** Implementar Lazy Loading o formatos de imagen más ligeros (WebP) para mejorar la velocidad en conexiones lentas.

---

### 3. Sistema de Notificaciones Push Avanzada
*   **Estado:** En revisión.
*   **Descripción:** Mejorar la segmentación de notificaciones para que los dueños puedan enviar promos personalizadas a grupos específicos de clientes.
