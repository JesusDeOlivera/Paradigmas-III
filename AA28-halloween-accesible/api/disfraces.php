<?php
/**
 * api/disfraces.php — Recurso REST "disfraces"
 *
 *   GET    api/disfraces.php              → lista de disfraces visibles (ranking por votos)
 *   GET    api/disfraces.php?todos=1      → todos, incluidos los eliminados (solo admin)
 *   GET    api/disfraces.php?id=5         → un disfraz
 *   POST   api/disfraces.php              → crear (multipart: nombre, descripcion, foto)   [usuario logueado]
 *   PUT    api/disfraces.php?id=5         → modificar (JSON, o multipart + X-HTTP-Method-Override: PUT si trae foto) [admin]
 *   DELETE api/disfraces.php?id=5         → eliminar (borrado lógico: eliminado = 1)        [admin]
 *   DELETE api/disfraces.php?id=5&definitivo=1 → borrar de la base (solo si ya estaba eliminado) [admin]
 *
 * Códigos: 200 OK · 201 Created · 400 datos inválidos · 401 sin sesión · 403 sin permiso
 *          404 no existe · 405 método no permitido · 413 imagen muy pesada · 415 formato no permitido
 */

require_once __DIR__ . '/../includes/api.php';

const MAX_NOMBRE       = 50;     // varchar(50)
const MAX_DESCRIPCION  = 1000;
const MAX_BYTES_FOTO   = 65535;  // capacidad de una columna BLOB
const TIPOS_PERMITIDOS = [
    IMAGETYPE_JPEG => 'image/jpeg',
    IMAGETYPE_PNG  => 'image/png',
    IMAGETYPE_GIF  => 'image/gif',
    IMAGETYPE_WEBP => 'image/webp',
];

$metodo = exigirMetodo('GET', 'POST', 'PUT', 'DELETE');

try {
    switch ($metodo) {
        case 'GET':    listarOMostrar($pdo);  break;
        case 'POST':   crear($pdo);           break;
        case 'PUT':    modificar($pdo);       break;
        case 'DELETE': eliminar($pdo);        break;
    }
} catch (PDOException $e) {
    error_log('Error en disfraces: ' . $e->getMessage());
    error(500, 'Error interno del servidor.');
}

/* =========================================================
   GET
   ========================================================= */
function listarOMostrar(PDO $pdo): void
{
    $usuario = usuarioActual();
    $id      = idDeQuery();
    $todos   = isset($_GET['todos']);

    if ($todos) {
        requerirAdmin(); // la papelera solo la ve el administrador
    }

    // LEFT JOIN con votos para saber si el usuario logueado ya votó cada disfraz
    $sql = 'SELECT d.id, d.nombre, d.descripcion, d.votos, d.eliminado,
                   LENGTH(d.foto_blob) AS peso_foto,
                   CASE WHEN v.id IS NULL THEN 0 ELSE 1 END AS votado
              FROM disfraces d
         LEFT JOIN votos v ON v.id_disfraz = d.id AND v.id_usuario = :usuario
             WHERE 1 = 1';

    if ($id !== null) {
        $sql .= ' AND d.id = :id';
    }
    if (!$todos && !($id !== null && esAdmin())) {
        $sql .= ' AND d.eliminado = 0';
    }
    $sql .= ' ORDER BY d.eliminado ASC, d.votos DESC, d.nombre ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':usuario', $usuario['id'] ?? 0, PDO::PARAM_INT);
    if ($id !== null) {
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    }
    $stmt->execute();
    $filas = array_map('formatearDisfraz', $stmt->fetchAll());

    if ($id !== null) {
        if (!$filas) {
            error(404, 'El disfraz no existe.');
        }
        responder(200, ['estado' => 'exito', 'data' => $filas[0]]);
    }

    responder(200, ['estado' => 'exito', 'total' => count($filas), 'data' => $filas]);
}

/** Da formato a una fila: tipos numéricos y URL de la foto. */
function formatearDisfraz(array $fila): array
{
    $peso = (int) $fila['peso_foto'];
    return [
        'id'          => (int) $fila['id'],
        'nombre'      => $fila['nombre'],
        'descripcion' => $fila['descripcion'],
        'votos'       => (int) $fila['votos'],
        'eliminado'   => (int) $fila['eliminado'] === 1,
        'votado'      => (int) $fila['votado'] === 1,
        // El peso se agrega a la URL para que el navegador no muestre una foto vieja tras editarla
        'foto_url'    => $peso > 0 ? "api/foto.php?id={$fila['id']}&v={$peso}" : null,
    ];
}

/* =========================================================
   POST — crear
   ========================================================= */
function crear(PDO $pdo): void
{
    $usuario = requerirLogin(); // cualquier usuario registrado puede subir su disfraz

    verificarTamanoPeticion();

    $nombre      = textoPost('nombre');
    $descripcion = textoPost('descripcion');
    validarTextos($nombre, $descripcion);

    $foto = procesarFoto();
    if ($foto === null && !$usuario['es_admin']) {
        error(400, 'Subí una foto de tu disfraz.');
    }

    $stmt = $pdo->prepare(
        'INSERT INTO disfraces (nombre, descripcion, votos, foto, foto_blob, eliminado)
         VALUES (:nombre, :descripcion, 0, :foto, :blob, 0)'
    );
    $stmt->bindValue(':nombre', $nombre, PDO::PARAM_STR);
    $stmt->bindValue(':descripcion', $descripcion, PDO::PARAM_STR);
    $stmt->bindValue(':foto', $foto['tipo'] ?? '', PDO::PARAM_STR);
    $stmt->bindValue(':blob', $foto['bytes'] ?? '', PDO::PARAM_LOB);
    $stmt->execute();

    responder(201, [
        'estado'  => 'exito',
        'mensaje' => 'Disfraz publicado. ¡Que empiecen los votos!',
        'data'    => buscarDisfraz($pdo, (int) $pdo->lastInsertId()),
    ]);
}

/* =========================================================
   PUT — modificar (solo admin)
   ========================================================= */
function modificar(PDO $pdo): void
{
    requerirAdmin();
    $id = idDeQuery() ?? error(400, 'Falta el id del disfraz.');
    buscarDisfraz($pdo, $id); // 404 si no existe

    // Con foto llega como multipart ($_POST / $_FILES); sin foto puede llegar como JSON
    $esMultipart = $_SERVER['REQUEST_METHOD'] === 'POST';
    if ($esMultipart) {
        verificarTamanoPeticion();
    }
    $datos = $esMultipart ? $_POST : leerJSON();

    $campos = [];      // columna => [valor, tipo PDO]

    if (array_key_exists('nombre', $datos) || array_key_exists('descripcion', $datos)) {
        $nombre      = is_string($datos['nombre'] ?? null) ? trim($datos['nombre']) : '';
        $descripcion = is_string($datos['descripcion'] ?? null) ? trim($datos['descripcion']) : '';
        validarTextos($nombre, $descripcion);
        $campos['nombre']      = [$nombre, PDO::PARAM_STR];
        $campos['descripcion'] = [$descripcion, PDO::PARAM_STR];
    }

    if (array_key_exists('eliminado', $datos)) { // permite restaurar desde la papelera
        $campos['eliminado'] = [filter_var($datos['eliminado'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0, PDO::PARAM_INT];
    }

    if ($esMultipart) {
        $foto = procesarFoto();
        if ($foto !== null) {
            $campos['foto']      = [$foto['tipo'], PDO::PARAM_STR];
            $campos['foto_blob'] = [$foto['bytes'], PDO::PARAM_LOB];
        } elseif (filter_var($datos['quitar_foto'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $campos['foto']      = ['', PDO::PARAM_STR];
            $campos['foto_blob'] = ['', PDO::PARAM_LOB];
        }
    }

    if (!$campos) {
        error(400, 'No se envió ningún dato para modificar.');
    }

    // Los nombres de columna salen de la lista fija de arriba, nunca del usuario
    $set  = implode(', ', array_map(fn($col) => "$col = :$col", array_keys($campos)));
    $stmt = $pdo->prepare("UPDATE disfraces SET $set WHERE id = :id");
    foreach ($campos as $columna => [$valor, $tipo]) {
        $stmt->bindValue(":$columna", $valor, $tipo);
    }
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Disfraz actualizado.',
        'data'    => buscarDisfraz($pdo, $id),
    ]);
}

/* =========================================================
   DELETE — eliminar (solo admin)
   ========================================================= */
function eliminar(PDO $pdo): void
{
    requerirAdmin();
    $id = idDeQuery() ?? error(400, 'Falta el id del disfraz.');
    $disfraz = buscarDisfraz($pdo, $id);

    if (isset($_GET['definitivo'])) {
        if (!$disfraz['eliminado']) {
            error(400, 'Primero enviá el disfraz a la papelera.');
        }
        // ON DELETE CASCADE borra también sus votos
        $stmt = $pdo->prepare('DELETE FROM disfraces WHERE id = :id');
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        responder(200, ['estado' => 'exito', 'mensaje' => 'Disfraz borrado definitivamente.']);
    }

    // Borrado lógico: se conserva el registro y sus votos, pero deja de mostrarse
    $stmt = $pdo->prepare('UPDATE disfraces SET eliminado = 1 WHERE id = :id');
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    responder(200, ['estado' => 'exito', 'mensaje' => 'Disfraz enviado a la papelera.']);
}

/* =========================================================
   Auxiliares
   ========================================================= */
function buscarDisfraz(PDO $pdo, int $id): array
{
    $stmt = $pdo->prepare(
        'SELECT id, nombre, descripcion, votos, eliminado, LENGTH(foto_blob) AS peso_foto, 0 AS votado
           FROM disfraces WHERE id = :id'
    );
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $fila = $stmt->fetch();
    if (!$fila) {
        error(404, 'El disfraz no existe.');
    }
    return formatearDisfraz($fila);
}

function textoPost(string $campo): string
{
    return is_string($_POST[$campo] ?? null) ? trim($_POST[$campo]) : '';
}

function validarTextos(string $nombre, string $descripcion): void
{
    if ($nombre === '' || mb_strlen($nombre) > MAX_NOMBRE) {
        error(400, 'El nombre es obligatorio (máximo ' . MAX_NOMBRE . ' caracteres).');
    }
    if ($descripcion === '' || mb_strlen($descripcion) > MAX_DESCRIPCION) {
        error(400, 'La descripción es obligatoria (máximo ' . MAX_DESCRIPCION . ' caracteres).');
    }
}

/** Si la petición supera post_max_size, PHP deja $_POST y $_FILES vacíos. */
function verificarTamanoPeticion(): void
{
    if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
        error(413, 'La imagen es demasiado pesada.');
    }
}

/**
 * Valida la imagen subida y devuelve ['tipo' => mime, 'bytes' => contenido],
 * o null si no se envió ninguna.
 */
function procesarFoto(): ?array
{
    if (!isset($_FILES['foto']) || $_FILES['foto']['error'] === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    $archivo = $_FILES['foto'];

    if ($archivo['error'] === UPLOAD_ERR_INI_SIZE || $archivo['error'] === UPLOAD_ERR_FORM_SIZE) {
        error(413, 'La imagen es demasiado pesada.');
    }
    if ($archivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])) {
        error(400, 'No se pudo recibir la imagen.');
    }
    if ($archivo['size'] > MAX_BYTES_FOTO) {
        error(413, 'La imagen supera los 64 KB que admite la base de datos. Probá con una más chica.');
    }

    $bytes = file_get_contents($archivo['tmp_name']);

    // El tipo se detecta leyendo el contenido real, no la extensión ni lo que diga el navegador
    $info = @getimagesizefromstring($bytes);
    if ($info === false || !isset(TIPOS_PERMITIDOS[$info[2]])) {
        error(415, 'Formato no permitido. Usá una imagen JPG, PNG, GIF o WEBP.');
    }

    return ['tipo' => TIPOS_PERMITIDOS[$info[2]], 'bytes' => $bytes];
}
