<?php
/**
 * POST api/logout.php — Cierre de sesión
 */

require_once __DIR__ . '/../includes/api.php';

exigirMetodo('POST');

cerrarSesion();

responder(200, ['estado' => 'exito', 'mensaje' => 'Sesión cerrada.']);
