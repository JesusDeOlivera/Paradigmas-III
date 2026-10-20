<?php
/**
 * api/perfil.php — Perfil del usuario autenticado
 *
 * Corrige los hallazgos 3 y 4:
 *  3. La identidad sale de $_SESSION: el cliente solo envía la cookie de sesión,
 *     nunca más el email y la contraseña.
 *  4. Todo dato que se imprime en HTML pasa por htmlspecialchars() → sin XSS.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';
require_once __DIR__ . '/../config/conexion.php';

requerirSesion(); // 401 si no hay sesión válida

/** Escapa un valor para imprimirlo de forma segura dentro de HTML. */
function e(?string $texto): string
{
    return htmlspecialchars($texto ?? '', ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

$stmt = $pdo->prepare('SELECT nombre, email, rol, creado_en FROM usuarios WHERE id = :id LIMIT 1');
$stmt->bindValue(':id', $_SESSION['usuario_id'], PDO::PARAM_INT);
$stmt->execute();
$usuario = $stmt->fetch();

if (!$usuario) {           // El usuario fue borrado mientras tenía la sesión abierta
    cerrarSesion();
    http_response_code(401);
    exit;
}

// Defensa extra contra XSS: el navegador solo ejecuta scripts del propio sitio
header("Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'");
header('X-Content-Type-Options: nosniff');
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Mi perfil</title>
</head>
<body>
    <h1>Bienvenido/a, <?= e($usuario['nombre']) ?></h1>
    <ul>
        <li>Email: <?= e($usuario['email']) ?></li>
        <li>Rol: <?= e($usuario['rol']) ?></li>
        <li>Alta: <?= e($usuario['creado_en']) ?></li>
    </ul>
    <form method="post" action="logout.php">
        <button type="submit">Cerrar sesión</button>
    </form>
</body>
</html>
