<?php
/**
 * api/mis_favoritos.php — Propiedades favoritas del usuario (ENDPOINT PRIVADO DEL DOMINIO)
 *
 *   GET                                  → lista de favoritas del usuario logueado
 *   POST { "propiedad_id": "villa-sarita" } → agrega o quita (toggle) una favorita
 *
 * Solo responde a usuarios autenticados: sin sesión devuelve 401 Unauthorized.
 * El usuario se toma de $_SESSION, nunca de un dato que mande el cliente,
 * así nadie puede leer ni modificar los favoritos de otra persona.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';

exigirMetodo('GET', 'POST');

// ===== GUARDIÁN DE SESIÓN =====
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['estado' => 'error', 'mensaje' => 'Acceso no autorizado. Iniciá sesión.'], JSON_UNESCAPED_UNICODE);
    exit;
}
$usuarioId = (int) $_SESSION['usuario_id'];

require_once __DIR__ . '/../config/conexion.php';

/** Catálogo de propiedades indexado por id (la misma fuente que usa el frontend). */
function catalogo(): array
{
    $json  = json_decode((string) file_get_contents(__DIR__ . '/../data/propiedades.json'), true);
    $porId = [];
    foreach ($json['propiedades'] ?? [] as $p) {
        $porId[$p['id']] = $p;
    }
    return $porId;
}

/** Favoritas del usuario, con los datos de cada propiedad para mostrarlas. */
function listarFavoritos(PDO $pdo, int $usuarioId): array
{
    $stmt = $pdo->prepare(
        'SELECT propiedad_id, creado_en
           FROM favoritos
          WHERE usuario_id = :usuario
       ORDER BY creado_en DESC'
    );
    $stmt->bindValue(':usuario', $usuarioId, PDO::PARAM_INT);
    $stmt->execute();

    $catalogo = catalogo();
    $lista    = [];
    foreach ($stmt->fetchAll() as $fila) {
        $p = $catalogo[$fila['propiedad_id']] ?? null;
        if (!$p) continue; // la propiedad ya no está publicada
        $lista[] = [
            'id'     => $p['id'],
            'titulo' => $p['titulo'],
            'barrio' => $p['barrio'],
            'precio' => $p['precio'],
            'ficha'  => $p['ficha'],
        ];
    }
    return $lista;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $favoritos = listarFavoritos($pdo, $usuarioId);
        responder(200, ['estado' => 'exito', 'total' => count($favoritos), 'data' => $favoritos]);
    }

    // ----- POST: alternar favorito -----
    $input       = leerJSON();
    $propiedadId = is_string($input['propiedad_id'] ?? null) ? $input['propiedad_id'] : '';

    // Solo se aceptan ids de propiedades que existen en el catálogo
    if (!array_key_exists($propiedadId, catalogo())) {
        responder(400, ['estado' => 'error', 'mensaje' => 'La propiedad indicada no existe.']);
    }

    $borrar = $pdo->prepare('DELETE FROM favoritos WHERE usuario_id = :usuario AND propiedad_id = :propiedad');
    $borrar->bindValue(':usuario',   $usuarioId,   PDO::PARAM_INT);
    $borrar->bindValue(':propiedad', $propiedadId, PDO::PARAM_STR);
    $borrar->execute();

    if ($borrar->rowCount() > 0) {
        $marcado = false; // ya era favorita: se quitó
    } else {
        $agregar = $pdo->prepare('INSERT INTO favoritos (usuario_id, propiedad_id) VALUES (:usuario, :propiedad)');
        $agregar->bindValue(':usuario',   $usuarioId,   PDO::PARAM_INT);
        $agregar->bindValue(':propiedad', $propiedadId, PDO::PARAM_STR);
        $agregar->execute();
        $marcado = true;
    }

    responder(200, [
        'estado'   => 'exito',
        'mensaje'  => $marcado ? 'Propiedad guardada en favoritas.' : 'Propiedad quitada de favoritas.',
        'marcado'  => $marcado,
        'data'     => listarFavoritos($pdo, $usuarioId),
    ]);

} catch (PDOException $e) {
    error_log('Error en mis_favoritos: ' . $e->getMessage());
    responder(500, ['estado' => 'error', 'mensaje' => 'Error interno del servidor.']);
}
