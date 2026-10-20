<?php
/**
 * POST api/registro.php — Alta de usuario
 * Cuerpo JSON: { "nombre": "...", "email": "...", "password": "..." }
 *
 * - Valida los datos en el servidor (la validación de app.js es solo para la UX).
 * - Hashea la contraseña con password_hash(..., PASSWORD_BCRYPT).
 * - Inserta con PDO Prepared Statements.
 * - Si el alta sale bien, deja la sesión iniciada (igual que el flujo original del sitio).
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';
require_once __DIR__ . '/../config/conexion.php';

exigirMetodo('POST');

$input    = leerJSON();
$nombre   = is_string($input['nombre']   ?? null) ? trim($input['nombre'])   : '';
$email    = is_string($input['email']    ?? null) ? trim($input['email'])    : '';
$password = is_string($input['password'] ?? null) ? $input['password']      : '';

// El nombre se guarda tal cual lo escribió el usuario: NO se aplica htmlspecialchars acá.
// La protección contra XSS se hace al MOSTRARLO (textContent en app.js), que es donde
// corresponde según el contexto de salida. Así el dato en la base queda limpio.
$errores = [];
if (mb_strlen($nombre) < 3 || mb_strlen($nombre) > 100) {
    $errores[] = 'Ingresá tu nombre completo (entre 3 y 100 caracteres).';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150) {
    $errores[] = 'Ingresá un e-mail válido.';
}
if (strlen($password) < 8 || strlen($password) > 72) { // 72 bytes: máximo que procesa BCRYPT
    $errores[] = 'La contraseña debe tener entre 8 y 72 caracteres.';
}
if ($errores) {
    responder(400, ['estado' => 'error', 'mensaje' => implode(' ', $errores)]);
}

// Hash BCRYPT: incluye sal aleatoria y costo; nunca se guarda la contraseña en texto plano
$passwordHash = password_hash($password, PASSWORD_BCRYPT);

try {
    $stmt = $pdo->prepare(
        'INSERT INTO usuarios (nombre, email, password, rol)
         VALUES (:nombre, :email, :password, :rol)'
    );
    $stmt->bindValue(':nombre',   $nombre,       PDO::PARAM_STR);
    $stmt->bindValue(':email',    $email,        PDO::PARAM_STR);
    $stmt->bindValue(':password', $passwordHash, PDO::PARAM_STR);
    $stmt->bindValue(':rol',      'cliente',     PDO::PARAM_STR); // el rol lo decide el servidor, no el cliente
    $stmt->execute();

    $usuario = [
        'id'     => (int) $pdo->lastInsertId(),
        'nombre' => $nombre,
        'email'  => $email,
        'rol'    => 'cliente',
    ];

    abrirSesion($usuario);

    responder(201, [
        'estado'  => 'exito',
        'mensaje' => 'Cuenta creada correctamente.',
        'usuario' => usuarioPublico($usuario),
    ]);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') { // violación de UNIQUE: e-mail ya registrado
        responder(409, ['estado' => 'error', 'mensaje' => 'Ya existe una cuenta con ese e-mail. Probá ingresar.']);
    }
    error_log('Error en registro: ' . $e->getMessage());
    responder(500, ['estado' => 'error', 'mensaje' => 'No se pudo crear la cuenta.']);
}
