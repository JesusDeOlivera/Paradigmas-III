<?php
/**
 * ✅ ALTA SEGURA DE PRODUCTOS — PDO + Consultas Preparadas (escritura)
 *
 * POST api/agregar-producto.php
 * Cuerpo JSON: { "nombre": "...", "categoria": "...", "precio": 1234.5, "stock": 10 }
 *
 * Mismo principio que el buscador: INSERT con marcadores y datos enviados aparte,
 * más validación de tipos y rangos antes de tocar la base.
 */

require_once __DIR__ . '/../config/conexion.php';

function responder(int $codigo, array $cuerpo): void {
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// 1) Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['estado' => 'error', 'mensaje' => 'Método no permitido.']);
}

// 2) Leer el JSON enviado por fetch
$entrada = json_decode(file_get_contents('php://input'), true);
if (!is_array($entrada)) {
    responder(400, ['estado' => 'error', 'mensaje' => 'El cuerpo debe ser un JSON válido.']);
}

// 3) Validación
$nombre    = isset($entrada['nombre'])    && is_string($entrada['nombre'])    ? trim($entrada['nombre'])    : '';
$categoria = isset($entrada['categoria']) && is_string($entrada['categoria']) ? trim($entrada['categoria']) : '';
$precio    = filter_var($entrada['precio'] ?? null, FILTER_VALIDATE_FLOAT);
$stock     = filter_var($entrada['stock']  ?? 0,    FILTER_VALIDATE_INT);

$errores = [];
if ($nombre === '' || mb_strlen($nombre) > 100)       $errores[] = 'El nombre es obligatorio (máx. 100 caracteres).';
if ($categoria === '' || mb_strlen($categoria) > 50)  $errores[] = 'La categoría es obligatoria (máx. 50 caracteres).';
if ($precio === false || $precio <= 0 || $precio > 99999999.99) $errores[] = 'El precio debe ser un número mayor a 0.';
if ($stock === false || $stock < 0)                   $errores[] = 'El stock debe ser un entero mayor o igual a 0.';

if ($errores) {
    responder(422, ['estado' => 'error', 'mensaje' => implode(' ', $errores)]);
}

// 4) INSERT preparado
try {
    $stmt = $pdo->prepare(
        'INSERT INTO productos (nombre, categoria, precio, stock)
         VALUES (:nombre, :categoria, :precio, :stock)'
    );
    $stmt->bindValue(':nombre',    $nombre,              PDO::PARAM_STR);
    $stmt->bindValue(':categoria', $categoria,           PDO::PARAM_STR);
    $stmt->bindValue(':precio',    number_format($precio, 2, '.', ''), PDO::PARAM_STR); // DECIMAL exacto
    $stmt->bindValue(':stock',     $stock,               PDO::PARAM_INT);
    $stmt->execute();

    responder(201, [
        'estado'  => 'exito',
        'mensaje' => 'Producto agregado correctamente.',
        'id'      => (int) $pdo->lastInsertId()
    ]);
} catch (PDOException $e) {
    error_log('Error en agregar-producto: ' . $e->getMessage());
    responder(500, ['estado' => 'error', 'mensaje' => 'No se pudo guardar el producto.']);
}
