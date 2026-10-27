<?php
/**
 * Sesión PHP con cookie segura + funciones para saber quién está logueado.
 * Lo usan la API (api/*.php) y la página protegida admin.php.
 */

/** Usuarios con permisos de administrador (la tabla usuarios no tiene columna de rol). */
const ADMINISTRADORES = ['admin'];

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');  // rechaza IDs de sesión inventados (fijación de sesión)
    ini_set('session.use_only_cookies', '1'); // el ID de sesión nunca viaja en la URL

    $esHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name('HALLOWEEN_SESION');
    session_set_cookie_params([
        'lifetime' => 0,          // se borra al cerrar el navegador
        'path'     => '/',
        'secure'   => $esHttps,   // solo por HTTPS si el sitio lo usa
        'httponly' => true,       // JavaScript no puede leer la cookie (protege ante XSS)
        'samesite' => 'Strict',   // no se envía desde otros sitios (protege ante CSRF)
    ]);

    session_start();
}

/** Devuelve el usuario logueado o null. */
function usuarioActual(): ?array
{
    if (!isset($_SESSION['usuario_id'])) {
        return null;
    }
    return [
        'id'       => (int) $_SESSION['usuario_id'],
        'nombre'   => $_SESSION['usuario_nombre'],
        'es_admin' => in_array($_SESSION['usuario_nombre'], ADMINISTRADORES, true),
    ];
}

function esAdmin(): bool
{
    $usuario = usuarioActual();
    return $usuario !== null && $usuario['es_admin'];
}

/** Inicia la sesión de un usuario recién autenticado. */
function abrirSesion(int $id, string $nombre): void
{
    session_regenerate_id(true); // nuevo ID al autenticarse: evita la fijación de sesión
    $_SESSION['usuario_id']     = $id;
    $_SESSION['usuario_nombre'] = $nombre;
}

/** Cierra la sesión en el servidor y borra la cookie del navegador. */
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

    session_destroy();
}
