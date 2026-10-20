<?php
/**
 * Sesión PHP con cookie segura + utilidades comunes de la API.
 * Se incluye al principio de cada endpoint.
 */

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');  // rechaza IDs de sesión inventados (fijación de sesión)
    ini_set('session.use_only_cookies', '1'); // el ID nunca viaja en la URL

    $esHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name('RN_SESION');
    session_set_cookie_params([
        'lifetime' => 0,         // se borra al cerrar el navegador
        'path'     => '/',
        'secure'   => $esHttps,  // solo por HTTPS cuando el sitio lo usa
        'httponly' => true,      // JavaScript no puede leer la cookie (mitiga robo por XSS)
        'samesite' => 'Lax',     // no se envía en peticiones POST desde otros sitios (CSRF)
    ]);

    session_start();
}

header('Content-Type: application/json; charset=utf-8');

/** Envía una respuesta JSON con su código HTTP y termina el script. */
function responder(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Lee el cuerpo JSON de la petición (fetch con Content-Type: application/json). */
function leerJSON(): array
{
    $datos = json_decode(file_get_contents('php://input'), true);
    return is_array($datos) ? $datos : [];
}

/** Exige un método HTTP; si no coincide responde 405. */
function exigirMetodo(string ...$metodos): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'], $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        responder(405, ['estado' => 'error', 'mensaje' => 'Método no permitido.']);
    }
}

/**
 * GUARDIÁN DE SESIÓN
 * Si no hay usuario autenticado responde 401 Unauthorized y corta la ejecución.
 */
function requerirSesion(): int
{
    if (!isset($_SESSION['usuario_id'])) {
        responder(401, ['estado' => 'error', 'mensaje' => 'Acceso no autorizado. Iniciá sesión.']);
    }
    return (int) $_SESSION['usuario_id'];
}

/** Inicia la sesión del usuario recién autenticado. */
function abrirSesion(array $usuario): void
{
    session_regenerate_id(true); // nuevo ID tras autenticarse: evita la fijación de sesión
    $_SESSION['usuario_id'] = (int) $usuario['id'];
    $_SESSION['rol']        = $usuario['rol'];
}

/** Datos públicos del usuario (nunca el hash). */
function usuarioPublico(array $usuario): array
{
    return [
        'id'     => (int) $usuario['id'],
        'nombre' => $usuario['nombre'],
        'email'  => $usuario['email'],
        'rol'    => $usuario['rol'],
    ];
}
