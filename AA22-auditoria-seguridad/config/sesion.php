<?php
/**
 * Inicio de sesión PHP con configuración segura.
 * Se incluye en TODOS los endpoints antes de usar $_SESSION.
 */

if (session_status() === PHP_SESSION_NONE) {
    // Solo se aceptan IDs de sesión generados por el servidor (evita fijación de sesión)
    ini_set('session.use_strict_mode', '1');
    // El ID viaja únicamente en cookie, nunca en la URL
    ini_set('session.use_only_cookies', '1');

    $esHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name('SGA_SESSID');
    session_set_cookie_params([
        'lifetime' => 0,          // La cookie muere al cerrar el navegador
        'path'     => '/',
        'secure'   => $esHttps,   // En producción (HTTPS) solo se envía cifrada
        'httponly' => true,       // JavaScript NO puede leerla: document.cookie no la expone
        'samesite' => 'Strict',   // No se envía en peticiones desde otros sitios (CSRF)
    ]);

    session_start();
}

/** Tiempo máximo de inactividad (segundos). */
const SESION_INACTIVIDAD_MAX = 1800; // 30 minutos

/**
 * Corta la ejecución con 401 si no hay un usuario autenticado
 * o si la sesión venció por inactividad.
 */
function requerirSesion(): void
{
    $vencida = isset($_SESSION['ultima_actividad'])
        && (time() - $_SESSION['ultima_actividad']) > SESION_INACTIVIDAD_MAX;

    if (empty($_SESSION['usuario_id']) || $vencida) {
        cerrarSesion();
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['estado' => 'error', 'mensaje' => 'Sesión no iniciada o vencida.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $_SESSION['ultima_actividad'] = time();
}

/** Destruye la sesión en el servidor y la cookie en el navegador. */
function cerrarSesion(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'],
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => $p['samesite'],
        ]);
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}
