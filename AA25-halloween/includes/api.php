<?php
/**
 * Utilidades comunes de la API REST (respuestas JSON, métodos HTTP, permisos).
 * Cada endpoint de api/ empieza con: require_once __DIR__ . '/../includes/api.php';
 */

declare(strict_types=1);

require_once __DIR__ . '/sesion.php';
require_once __DIR__ . '/conexion.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** Envía una respuesta JSON con su código HTTP y termina. */
function responder(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

function error(int $codigo, string $mensaje): void
{
    responder($codigo, ['estado' => 'error', 'mensaje' => $mensaje]);
}

/**
 * Método HTTP real de la petición.
 * Los formularios con archivos solo pueden enviarse por POST: para usar PUT con
 * una imagen, el frontend manda POST + la cabecera X-HTTP-Method-Override: PUT.
 */
function metodo(): string
{
    $metodo   = $_SERVER['REQUEST_METHOD'];
    $override = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '');
    if ($metodo === 'POST' && in_array($override, ['PUT', 'DELETE'], true)) {
        return $override;
    }
    return $metodo;
}

/** Corta con 405 si el método no está permitido. */
function exigirMetodo(string ...$permitidos): string
{
    $metodo = metodo();
    if (!in_array($metodo, $permitidos, true)) {
        header('Allow: ' . implode(', ', $permitidos));
        error(405, 'Método no permitido.');
    }

    // Protección CSRF: las peticiones que modifican datos deben venir de nuestro
    // propio JavaScript (fetch agrega esta cabecera; un formulario de otro sitio no puede).
    if ($metodo !== 'GET' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch') {
        error(403, 'Petición no permitida.');
    }
    return $metodo;
}

/** Lee el cuerpo JSON de la petición. */
function leerJSON(): array
{
    $datos = json_decode((string) file_get_contents('php://input'), true);
    return is_array($datos) ? $datos : [];
}

/** 401 si no hay usuario logueado. */
function requerirLogin(): array
{
    $usuario = usuarioActual();
    if ($usuario === null) {
        error(401, 'Tenés que iniciar sesión.');
    }
    return $usuario;
}

/** 401 sin sesión, 403 si el usuario no es administrador. */
function requerirAdmin(): array
{
    $usuario = requerirLogin();
    if (!$usuario['es_admin']) {
        error(403, 'Solo el administrador puede hacer esto.');
    }
    return $usuario;
}

/** Lee un id entero positivo de la query string (?id=5). */
function idDeQuery(string $parametro = 'id'): ?int
{
    if (!isset($_GET[$parametro])) {
        return null;
    }
    $id = filter_var($_GET[$parametro], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        error(400, 'Identificador inválido.');
    }
    return $id;
}
