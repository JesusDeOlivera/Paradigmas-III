<?php
/**
 * POST api/login.php — Inicio de sesión
 * Cuerpo JSON: { "email": "...", "password": "..." }
 *
 * - Busca al usuario por e-mail con consulta preparada.
 * - Verifica la contraseña con password_verify() contra el hash BCRYPT.
 * - session_start() (en config/sesion.php) + session_regenerate_id(true)
 *   y guarda el identificador en $_SESSION['usuario_id'].
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';   // session_start()
require_once __DIR__ . '/../config/conexion.php';

exigirMetodo('POST');

$input    = leerJSON();
$email    = is_string($input['email']    ?? null) ? trim($input['email']) : '';
$password = is_string($input['password'] ?? null) ? $input['password']    : '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 72) {
    responder(400, ['estado' => 'error', 'mensaje' => 'Ingresá un e-mail y una contraseña válidos.']);
}

try {
    // La contraseña NO va en el WHERE: se compara en PHP contra el hash
    $stmt = $pdo->prepare(
        'SELECT id, nombre, email, password, rol
           FROM usuarios
          WHERE email = :email
          LIMIT 1'
    );
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $usuario = $stmt->fetch();

    // Si el e-mail no existe se verifica igual contra un hash ficticio:
    // el tiempo de respuesta es el mismo y no se revela qué cuentas existen.
    $hashFicticio = '$2y$10$FKQkvWtL3c4TxNQhsoQ6J.Qqg7Lpfb7oYy5XfwIzlc1SAj0iQOdhK';
    $passwordOk   = password_verify($password, $usuario['password'] ?? $hashFicticio);

    if (!$usuario || !$passwordOk) {
        // Mismo mensaje en ambos casos: no se indica si falló el e-mail o la clave
        responder(401, ['estado' => 'error', 'mensaje' => 'El e-mail o la contraseña no son correctos.']);
    }

    // session_regenerate_id(true) + $_SESSION['usuario_id']
    abrirSesion($usuario);

    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Autenticación exitosa.',
        'usuario' => usuarioPublico($usuario), // sin el hash
    ]);

} catch (PDOException $e) {
    error_log('Error en login: ' . $e->getMessage());
    responder(500, ['estado' => 'error', 'mensaje' => 'Error interno del servidor.']);
}
