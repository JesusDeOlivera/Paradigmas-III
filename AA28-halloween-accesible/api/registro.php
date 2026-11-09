<?php
/**
 * POST api/registro.php — Alta de usuario
 * Cuerpo JSON: { "nombre": "...", "clave": "..." }
 *
 *   201 → usuario creado y sesión iniciada
 *   400 → datos inválidos
 *   409 → el nombre de usuario ya existe
 */

require_once __DIR__ . '/../includes/api.php';

exigirMetodo('POST');

$datos  = leerJSON();
$nombre = is_string($datos['nombre'] ?? null) ? trim($datos['nombre']) : '';
$clave  = is_string($datos['clave'] ?? null) ? $datos['clave'] : '';

// Validación en el servidor (la del formulario es solo para comodidad del usuario)
if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $nombre)) {
    error(400, 'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.');
}
if (strlen($clave) < 8 || strlen($clave) > 72) { // 72 bytes es el máximo que procesa BCRYPT
    error(400, 'La contraseña debe tener entre 8 y 72 caracteres.');
}
// Nadie puede registrarse con un nombre reservado para administradores
if (in_array(strtolower($nombre), ADMINISTRADORES, true)) {
    error(409, 'Ese nombre de usuario no está disponible.');
}

try {
    // Comprobación previa (el índice UNIQUE de la tabla es la garantía final)
    $existe = $pdo->prepare('SELECT 1 FROM usuarios WHERE nombre = :nombre LIMIT 1');
    $existe->bindValue(':nombre', $nombre, PDO::PARAM_STR);
    $existe->execute();
    if ($existe->fetch()) {
        error(409, 'Ese nombre de usuario ya está registrado.');
    }

    // La contraseña se guarda como hash BCRYPT, nunca en texto plano
    $stmt = $pdo->prepare('INSERT INTO usuarios (nombre, clave) VALUES (:nombre, :clave)');
    $stmt->bindValue(':nombre', $nombre, PDO::PARAM_STR);
    $stmt->bindValue(':clave', password_hash($clave, PASSWORD_BCRYPT), PDO::PARAM_STR);
    $stmt->execute();

    $id = (int) $pdo->lastInsertId();
    abrirSesion($id, $nombre);

    responder(201, [
        'estado'  => 'exito',
        'mensaje' => '¡Cuenta creada! Ya podés votar.',
        'usuario' => usuarioActual(),
    ]);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') { // índice UNIQUE: dos registros simultáneos con el mismo nombre
        error(409, 'Ese nombre de usuario ya está registrado.');
    }
    error_log('Error en registro: ' . $e->getMessage());
    error(500, 'No se pudo crear la cuenta.');
}
