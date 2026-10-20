<?php
/**
 * POST api/logout.php — Cierre de sesión
 * Vacía $_SESSION, borra la cookie del navegador y destruye la sesión en el servidor.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';

exigirMetodo('POST');

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

responder(200, ['estado' => 'exito', 'mensaje' => 'Sesión cerrada correctamente.']);
