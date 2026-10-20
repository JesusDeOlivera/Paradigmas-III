<?php
/**
 * api/login.php — Autenticación segura
 *
 * POST JSON: { "email": "...", "password": "..." }
 *
 * Corrige los hallazgos 1, 2 y 3 de la auditoría:
 *  1. Consulta preparada con PDO        → sin inyección SQL
 *  2. password_verify() contra BCRYPT   → la contraseña nunca se compara ni se guarda en texto plano
 *  3. session_start() + regenerate_id   → el backend recuerda al usuario; no se reenvían credenciales
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';   // session_start() con cookie segura
require_once __DIR__ . '/../config/conexion.php'; // $pdo

header('Content-Type: application/json; charset=utf-8');

function responder(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// 1) Solo POST: las credenciales nunca viajan en la URL
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['estado' => 'error', 'mensaje' => 'Método no permitido.']);
}

// 2) Lectura y validación de la entrada
$datos    = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$email    = is_string($datos['email']    ?? null) ? trim($datos['email']) : '';
$password = is_string($datos['password'] ?? null) ? $datos['password']   : '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 72) {
    // 72 bytes es el máximo que BCRYPT procesa
    responder(400, ['estado' => 'error', 'mensaje' => 'Email o contraseña con formato inválido.']);
}

try {
    // 3) Consulta preparada: se busca SOLO por email.
    //    La contraseña NO va en el WHERE: se verifica en PHP contra el hash.
    $stmt = $pdo->prepare(
        'SELECT id, nombre, email, password_hash, rol
           FROM usuarios
          WHERE email = :email
          LIMIT 1'
    );
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $usuario = $stmt->fetch();

    // 4) Verificación BCRYPT.
    //    Si el email no existe se verifica igual contra un hash ficticio para que
    //    el tiempo de respuesta sea el mismo y no se pueda averiguar qué emails existen.
    $hashFicticio = '$2y$12$xCydsmoTmaA30w3vZLYFrud/UKTmsEsn3vtgnnoNJVWOM26Xx1vaG';
    $hash         = $usuario['password_hash'] ?? $hashFicticio;
    $valida       = password_verify($password, $hash);

    if (!$usuario || !$valida) {
        // Mensaje único: no revela si falló el email o la contraseña
        responder(401, ['estado' => 'error', 'mensaje' => 'Credenciales incorrectas.']);
    }

    // 5) Si el hash se generó con un costo viejo, se actualiza de forma transparente
    if (password_needs_rehash($usuario['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
        $nuevo = $pdo->prepare('UPDATE usuarios SET password_hash = :hash WHERE id = :id');
        $nuevo->bindValue(':hash', password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), PDO::PARAM_STR);
        $nuevo->bindValue(':id',   (int) $usuario['id'], PDO::PARAM_INT);
        $nuevo->execute();
    }

    // 6) Sesión segura:
    //    - Nuevo ID de sesión al autenticarse (evita fijación de sesión)
    //    - Se guarda lo mínimo; NUNCA la contraseña ni el hash
    session_regenerate_id(true);
    $_SESSION['usuario_id']       = (int) $usuario['id'];
    $_SESSION['rol']              = $usuario['rol'];
    $_SESSION['ultima_actividad'] = time();

    // 7) Respuesta: el hash no se envía al cliente
    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Sesión iniciada.',
        'usuario' => [
            'id'     => (int) $usuario['id'],
            'nombre' => $usuario['nombre'],
            'rol'    => $usuario['rol'],
        ],
    ]);

} catch (PDOException $e) {
    error_log('Error en login: ' . $e->getMessage()); // detalle solo en el log del servidor
    responder(500, ['estado' => 'error', 'mensaje' => 'No se pudo iniciar sesión.']);
}
