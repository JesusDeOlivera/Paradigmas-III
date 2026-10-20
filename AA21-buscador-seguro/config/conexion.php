<?php
/**
 * Conexión PDO a MySQL.
 *
 * Nota: en el archivo original la línea de $host había quedado comentada
 * por error (pegada al comentario de arriba), por lo que $host no existía.
 * Acá queda corregido.
 */

// Credenciales del servidor MySQL
// XAMPP trae por defecto usuario 'root' SIN contraseña: si es tu caso, dejá $pass = ''
$host    = 'localhost';
$db      = 'clase_backend';
$user    = 'root';
$pass    = 'root';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

// Opciones del driver PDO
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // Lanza PDOException ante errores
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,       // Devuelve arreglos asociativos
    PDO::ATTR_EMULATE_PREPARES   => false,                  // Prepared statements REALES (del lado del servidor)
];

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    // No se expone el mensaje interno al cliente: se registra en el log del servidor
    error_log('Error de conexión PDO: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'estado'  => 'error',
        'mensaje' => 'Error de conexión con la base de datos.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
