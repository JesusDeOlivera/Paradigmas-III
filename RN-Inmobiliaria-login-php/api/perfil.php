<?php
/**
 * GET api/perfil.php — Datos del usuario autenticado (endpoint privado)
 *
 * El frontend lo consulta al cargar cada página para saber si hay sesión:
 *   200 → usuario autenticado (se muestra la vista "usuario")
 *   401 → visitante (se muestra la vista "visitante")
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';

exigirMetodo('GET');

// GUARDIÁN DE SESIÓN: sin $_SESSION['usuario_id'] → 401 Unauthorized
$usuarioId = requerirSesion();

require_once __DIR__ . '/../config/conexion.php';

try {
    // Se leen los datos frescos de la base (si cambió el nombre, se ve al instante)
    $stmt = $pdo->prepare('SELECT id, nombre, email, rol FROM usuarios WHERE id = :id LIMIT 1');
    $stmt->bindValue(':id', $usuarioId, PDO::PARAM_INT);
    $stmt->execute();
    $usuario = $stmt->fetch();

    if (!$usuario) { // la cuenta se borró con la sesión abierta
        $_SESSION = [];
        session_destroy();
        responder(401, ['estado' => 'error', 'mensaje' => 'La cuenta ya no existe.']);
    }

    responder(200, ['estado' => 'exito', 'data' => usuarioPublico($usuario)]);

} catch (PDOException $e) {
    error_log('Error en perfil: ' . $e->getMessage());
    responder(500, ['estado' => 'error', 'mensaje' => 'Error interno del servidor.']);
}
