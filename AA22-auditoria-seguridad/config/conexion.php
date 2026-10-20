<?php
/**
 * Conexión PDO segura a MySQL.
 * XAMPP trae 'root' sin contraseña: si es tu caso, dejá $pass = ''.
 */

$host    = 'localhost';
$db      = 'gestion_academica';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false, // Prepared statements reales en MySQL
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    error_log('Error de conexión PDO: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['estado' => 'error', 'mensaje' => 'Servicio no disponible.'], JSON_UNESCAPED_UNICODE);
    exit;
}
