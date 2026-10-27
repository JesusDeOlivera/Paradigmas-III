<?php
/**
 * api/votos.php — Recurso REST "votos" (requiere sesión)
 *
 *   GET    api/votos.php                    → ids de los disfraces que votó el usuario logueado
 *   POST   api/votos.php   { "id_disfraz": 5 } → votar
 *   DELETE api/votos.php?id_disfraz=5       → quitar el voto
 *
 *   401 → sin sesión · 404 → el disfraz no existe · 409 → ya votó ese disfraz
 *
 * Votos duplicados: se evitan en dos niveles
 *   1) se consulta si el voto ya existe antes de insertarlo;
 *   2) el índice UNIQUE (id_usuario, id_disfraz) de la tabla votos lo impide
 *      incluso si llegan dos clics al mismo tiempo.
 */

require_once __DIR__ . '/../includes/api.php';

$metodo  = exigirMetodo('GET', 'POST', 'DELETE');
$usuario = requerirLogin(); // solo usuarios registrados pueden votar

try {
    if ($metodo === 'GET') {
        $stmt = $pdo->prepare('SELECT id_disfraz FROM votos WHERE id_usuario = :usuario ORDER BY id');
        $stmt->bindValue(':usuario', $usuario['id'], PDO::PARAM_INT);
        $stmt->execute();
        $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        responder(200, ['estado' => 'exito', 'data' => $ids]);
    }

    $idDisfraz = $metodo === 'POST'
        ? filter_var(leerJSON()['id_disfraz'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])
        : idDeQuery('id_disfraz');

    if (!$idDisfraz) {
        error(400, 'Falta indicar el disfraz.');
    }

    // El disfraz tiene que existir y no estar eliminado
    $stmt = $pdo->prepare('SELECT id FROM disfraces WHERE id = :id AND eliminado = 0');
    $stmt->bindValue(':id', $idDisfraz, PDO::PARAM_INT);
    $stmt->execute();
    if (!$stmt->fetch()) {
        error(404, 'El disfraz no existe.');
    }

    if ($metodo === 'POST') {
        votar($pdo, $usuario['id'], $idDisfraz);
    } else {
        quitarVoto($pdo, $usuario['id'], $idDisfraz);
    }

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($e->getCode() === '23000') { // índice UNIQUE: voto duplicado
        error(409, 'Ya votaste este disfraz.');
    }
    error_log('Error en votos: ' . $e->getMessage());
    error(500, 'Error interno del servidor.');
}

function votar(PDO $pdo, int $idUsuario, int $idDisfraz): void
{
    $existe = $pdo->prepare('SELECT 1 FROM votos WHERE id_usuario = :usuario AND id_disfraz = :disfraz');
    $existe->bindValue(':usuario', $idUsuario, PDO::PARAM_INT);
    $existe->bindValue(':disfraz', $idDisfraz, PDO::PARAM_INT);
    $existe->execute();
    if ($existe->fetch()) {
        error(409, 'Ya votaste este disfraz.');
    }

    // Transacción: el voto y el contador se guardan juntos o no se guarda ninguno
    $pdo->beginTransaction();

    $insertar = $pdo->prepare('INSERT INTO votos (id_usuario, id_disfraz) VALUES (:usuario, :disfraz)');
    $insertar->bindValue(':usuario', $idUsuario, PDO::PARAM_INT);
    $insertar->bindValue(':disfraz', $idDisfraz, PDO::PARAM_INT);
    $insertar->execute();

    $sumar = $pdo->prepare('UPDATE disfraces SET votos = votos + 1 WHERE id = :disfraz');
    $sumar->bindValue(':disfraz', $idDisfraz, PDO::PARAM_INT);
    $sumar->execute();

    $pdo->commit();

    responder(201, [
        'estado'  => 'exito',
        'mensaje' => '¡Voto registrado!',
        'votos'   => contarVotos($pdo, $idDisfraz),
    ]);
}

function quitarVoto(PDO $pdo, int $idUsuario, int $idDisfraz): void
{
    $pdo->beginTransaction();

    $borrar = $pdo->prepare('DELETE FROM votos WHERE id_usuario = :usuario AND id_disfraz = :disfraz');
    $borrar->bindValue(':usuario', $idUsuario, PDO::PARAM_INT);
    $borrar->bindValue(':disfraz', $idDisfraz, PDO::PARAM_INT);
    $borrar->execute();

    if ($borrar->rowCount() === 0) {
        $pdo->rollBack();
        error(404, 'No habías votado este disfraz.');
    }

    $restar = $pdo->prepare(
        'UPDATE disfraces SET votos = CASE WHEN votos > 0 THEN votos - 1 ELSE 0 END WHERE id = :disfraz'
    );
    $restar->bindValue(':disfraz', $idDisfraz, PDO::PARAM_INT);
    $restar->execute();

    $pdo->commit();

    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Voto quitado.',
        'votos'   => contarVotos($pdo, $idDisfraz),
    ]);
}

function contarVotos(PDO $pdo, int $idDisfraz): int
{
    $stmt = $pdo->prepare('SELECT votos FROM disfraces WHERE id = :id');
    $stmt->bindValue(':id', $idDisfraz, PDO::PARAM_INT);
    $stmt->execute();
    return (int) $stmt->fetchColumn();
}
