<?php
/**
 * ✅ BUSCADOR SEGURO — PDO + Consultas Preparadas
 *
 * GET api/buscador-seguro.php?q=texto
 *
 * Por qué es seguro:
 *  1. La consulta SQL se envía al servidor con marcadores (:nombre, :categoria)
 *     y SIN el dato del usuario. El motor la compila primero.
 *  2. El valor se envía después, por separado, con bindValue(). MySQL lo trata
 *     siempre como DATO, nunca como código SQL: una comilla (') no puede
 *     "cerrar" el string ni agregar condiciones como OR 1=1 o UNION SELECT.
 *  3. ATTR_EMULATE_PREPARES = false (en conexion.php) garantiza que la
 *     preparación la haga MySQL y no una emulación de PHP.
 */

require_once __DIR__ . '/../config/conexion.php';

// 1) Solo se acepta el método GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2) Validación de la entrada (tipo y longitud)
$q = $_GET['q'] ?? '';

if (!is_string($q)) { // evita q[]=... (arreglos)
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'Parámetro inválido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$q = trim($q);

if (mb_strlen($q) > 100) {
    http_response_code(400);
    echo json_encode(['estado' => 'error', 'mensaje' => 'La búsqueda no puede superar los 100 caracteres.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3) Escapar los comodines del LIKE (% y _) para que se busquen literalmente.
//    Esto NO es para evitar la inyección (eso lo hace la consulta preparada),
//    sino para que buscar "%" no devuelva toda la tabla.
$qLike = '%' . addcslashes($q, '%_\\') . '%';

try {
    // 4) Consulta con marcadores: el dato NUNCA se concatena al SQL.
    //    Con emulación desactivada no se puede repetir un mismo marcador,
    //    por eso se usan dos (:nombre y :categoria).
    $sql = 'SELECT id, nombre, categoria, precio, stock
              FROM productos
             WHERE nombre LIKE :nombre
                OR categoria LIKE :categoria
          ORDER BY nombre ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':nombre',    $qLike, PDO::PARAM_STR);
    $stmt->bindValue(':categoria', $qLike, PDO::PARAM_STR);
    $stmt->execute();

    $productos = $stmt->fetchAll();

    http_response_code(200);
    echo json_encode([
        'estado' => 'exito',
        'total'  => count($productos),
        'data'   => $productos
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    // El detalle técnico queda en el log; al cliente se le da un mensaje genérico
    error_log('Error en buscador-seguro: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['estado' => 'error', 'mensaje' => 'No se pudo realizar la búsqueda.'], JSON_UNESCAPED_UNICODE);
}
