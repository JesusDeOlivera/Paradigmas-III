<?php
/**
 * POST api/login.php — Inicio de sesión
 * Cuerpo JSON: { "nombre": "...", "clave": "..." }
 *
 *   200 → sesión iniciada
 *   400 → faltan datos
 *   401 → usuario o contraseña incorrectos
 */

require_once __DIR__ . '/../includes/api.php';

exigirMetodo('POST');

$datos  = leerJSON();
$nombre = is_string($datos['nombre'] ?? null) ? trim($datos['nombre']) : '';
$clave  = is_string($datos['clave'] ?? null) ? $datos['clave'] : '';

if ($nombre === '' || $clave === '' || strlen($clave) > 72) {
    error(400, 'Ingresá tu usuario y tu contraseña.');
}

try {
    // Consulta preparada: se busca solo por nombre; la contraseña se verifica en PHP
    $stmt = $pdo->prepare('SELECT id, nombre, clave FROM usuarios WHERE nombre = :nombre LIMIT 1');
    $stmt->bindValue(':nombre', $nombre, PDO::PARAM_STR);
    $stmt->execute();
    $usuario = $stmt->fetch();

    // Si el usuario no existe se verifica igual contra un hash ficticio:
    // así el tiempo de respuesta no revela qué usuarios existen.
    $hashFicticio = '$2y$10$oJv7dxnWH6aCOVCPGIZIn.tSZjqMy0ZMWKY0H8HYngluSYP0z8OQK';
    $claveOk      = password_verify($clave, $usuario['clave'] ?? $hashFicticio);

    if (!$usuario || !$claveOk) {
        error(401, 'Usuario o contraseña incorrectos.'); // mismo mensaje en ambos casos
    }

    abrirSesion((int) $usuario['id'], $usuario['nombre']);

    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Sesión iniciada.',
        'usuario' => usuarioActual(),
    ]);

} catch (PDOException $e) {
    error_log('Error en login: ' . $e->getMessage());
    error(500, 'No se pudo iniciar sesión.');
}
