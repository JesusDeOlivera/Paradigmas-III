<?php
/**
 * Conexión PDO a la base "halloween".
 * XAMPP trae el usuario 'root' SIN contraseña. Si tu MySQL tiene clave, cambiá $pass.
 */

$host    = 'localhost';
$db      = 'halloween';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;port=3306;dbname=$db;charset=$charset";

$opciones = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // los errores lanzan PDOException
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // filas como arrays asociativos
    PDO::ATTR_EMULATE_PREPARES   => false,                  // consultas preparadas reales
];

try {
    $pdo = new PDO($dsn, $user, $pass, $opciones);
} catch (PDOException $e) {
    error_log('Error de conexión PDO: ' . $e->getMessage()); // el detalle queda en el log, no en la pantalla
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'estado'  => 'error',
        'mensaje' => 'No se pudo conectar con la base de datos. ¿Están encendidos Apache y MySQL en XAMPP y se importó sql/halloween.sql?',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
