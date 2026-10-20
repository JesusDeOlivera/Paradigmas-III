<?php
/**
 * api/logout.php — Cierre de sesión
 * Destruye la sesión en el servidor y borra la cookie del navegador.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

cerrarSesion();

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['estado' => 'exito', 'mensaje' => 'Sesión cerrada.'], JSON_UNESCAPED_UNICODE);
