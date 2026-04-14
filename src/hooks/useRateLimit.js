import { useState, useCallback } from 'react';

/**
 * Hook de Rate Limiting del lado del cliente.
 * Protege contra fuerza bruta bloqueando temporalmente después de N intentos fallidos.
 * 
 * SECURITY FIX A-03: Throttling para Login, Register y ForgotPassword.
 * 
 * @param {Object} options
 * @param {number} options.maxAttempts - Máximo de intentos antes de bloqueo (default: 5)
 * @param {number} options.lockoutDuration - Duración del bloqueo en ms (default: 60000 = 1 min)
 * @param {number} options.escalationFactor - Multiplicador del bloqueo por cada ciclo (default: 2)
 * @param {number} options.maxLockoutDuration - Duración máxima del bloqueo en ms (default: 300000 = 5 min)
 */
export function useRateLimit({
    maxAttempts = 5,
    lockoutDuration = 60000,
    escalationFactor = 2,
    maxLockoutDuration = 300000,
} = {}) {
    const [attempts, setAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(null);
    const [lockoutCycles, setLockoutCycles] = useState(0);

    /**
     * Verifica si el usuario está bloqueado.
     * @returns {{ blocked: boolean, secondsLeft: number }}
     */
    const checkBlocked = useCallback(() => {
        if (lockoutUntil && Date.now() < lockoutUntil) {
            const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
            return { blocked: true, secondsLeft };
        }

        // Si el lockout expiró, limpiar el estado
        if (lockoutUntil && Date.now() >= lockoutUntil) {
            setLockoutUntil(null);
        }

        return { blocked: false, secondsLeft: 0 };
    }, [lockoutUntil]);

    /**
     * Registrar un intento fallido. Si se supera el máximo, activa el bloqueo.
     */
    const recordFailure = useCallback(() => {
        setAttempts((prev) => {
            const newAttempts = prev + 1;

            if (newAttempts >= maxAttempts) {
                // Calcular duración escalada: 1min → 2min → 4min → (max 5min)
                const currentLockout = Math.min(
                    lockoutDuration * Math.pow(escalationFactor, lockoutCycles),
                    maxLockoutDuration
                );
                setLockoutUntil(Date.now() + currentLockout);
                setLockoutCycles((c) => c + 1);
                return 0; // Reset counter for next cycle
            }

            return newAttempts;
        });
    }, [maxAttempts, lockoutDuration, escalationFactor, lockoutCycles, maxLockoutDuration]);

    /**
     * Registrar un intento exitoso. Resetea todos los contadores.
     */
    const recordSuccess = useCallback(() => {
        setAttempts(0);
        setLockoutUntil(null);
        setLockoutCycles(0);
    }, []);

    /**
     * Número de intentos restantes antes del bloqueo.
     */
    const remainingAttempts = maxAttempts - attempts;

    return {
        checkBlocked,
        recordFailure,
        recordSuccess,
        remainingAttempts,
        attempts,
    };
}

export default useRateLimit;
