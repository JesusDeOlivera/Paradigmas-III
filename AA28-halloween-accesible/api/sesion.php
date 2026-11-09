<?php
/**
 * GET api/sesion.php — ¿Quién está logueado?
 *
 * El frontend lo consulta al cargar cada página para armar el menú:
 *   { "autenticado": false }
 *   { "autenticado": true, "usuario": { "id": 2, "nombre": "ana", "es_admin": false } }
 */

require_once __DIR__ . '/../includes/api.php';

exigirMetodo('GET');

$usuario = usuarioActual();

responder(200, $usuario
    ? ['estado' => 'exito', 'autenticado' => true, 'usuario' => $usuario]
    : ['estado' => 'exito', 'autenticado' => false]);
