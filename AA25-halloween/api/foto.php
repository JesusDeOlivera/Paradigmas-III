<?php
/**
 * GET api/foto.php?id=5 — Devuelve la imagen guardada en disfraces.foto_blob
 *
 * Se usa directamente como src de una etiqueta <img>.
 */

require_once __DIR__ . '/../includes/api.php';

exigirMetodo('GET');

$id = idDeQuery() ?? error(400, 'Falta el id del disfraz.');

$TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

try {
    $stmt = $pdo->prepare('SELECT foto, foto_blob, eliminado FROM disfraces WHERE id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $fila = $stmt->fetch();
} catch (PDOException $e) {
    error_log('Error en foto: ' . $e->getMessage());
    error(500, 'Error interno del servidor.');
}

// Los disfraces eliminados solo los ve el administrador
$visible = $fila && ((int) $fila['eliminado'] === 0 || esAdmin());

if (!$visible || $fila['foto_blob'] === '' || $fila['foto_blob'] === null
    || !in_array($fila['foto'], $TIPOS_PERMITIDOS, true)) {
    error(404, 'Imagen no encontrada.');
}

// Se reemplazan las cabeceras JSON por las de la imagen
header('Content-Type: ' . $fila['foto']);
header('Content-Length: ' . strlen($fila['foto_blob']));
header('Content-Disposition: inline');
header("Content-Security-Policy: default-src 'none'"); // la imagen no puede ejecutar nada
header('Cache-Control: private, max-age=86400');       // la URL cambia si la foto cambia

echo $fila['foto_blob'];
