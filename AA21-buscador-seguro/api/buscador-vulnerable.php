<?php
// ❌ CÓDIGO VULNERABLE: Concatenación directa dentro del LIKE
require_once '../config/conexion.php';

$q = $_GET['q'] ?? '';


// La concatenación permite romper el string SQL con comillas simples
$sql = "SELECT * FROM productos WHERE nombre LIKE '%" . $q . "%'";
$resultado = $pdo->query($sql);

//echo json_encode($resultado->fetchAll());
$resultado=$resultado->fetchAll();
 http_response_code(200);
    echo json_encode([
        "estado" => "exito",
        "total"  => count($resultado),
        "data"   => $resultado
    ], JSON_UNESCAPED_UNICODE);
