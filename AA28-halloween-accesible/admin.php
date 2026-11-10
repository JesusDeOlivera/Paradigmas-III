<?php
/**
 * admin.php — Panel de administración (CRUD de disfraces)
 *
 * La página se protege EN EL SERVIDOR: si no hay sesión se redirige al login,
 * y si el usuario no es administrador se responde 403. Así el HTML del panel
 * nunca llega al navegador de alguien sin permiso.
 * Además, cada operación de la API vuelve a verificar el permiso (requerirAdmin).
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/sesion.php';

$usuario = usuarioActual();

if ($usuario === null) {
    header('Location: login.html?volver=admin.php');
    exit;
}

if (!$usuario['es_admin']) {
    http_response_code(403);
    ?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso denegado — Noche de Disfraces</title>
  <link rel="stylesheet" href="css/estilos.css">
</head>
<body class="pagina-acceso">
  <main id="contenido" class="acceso" tabindex="-1">
    <div class="tarjeta-formulario tarjeta-acceso">
      <p class="acceso-icono" aria-hidden="true">💀</p>
      <h1>Acceso denegado</h1>
      <p class="ayuda">Esta sección es solo para el administrador.</p>
      <a href="index.html" class="boton boton-principal boton-ancho">Volver a los disfraces</a>
    </div>
  </main>
</body>
</html>
    <?php
    exit;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Administración — Noche de Disfraces</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕯️</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;700;800&family=Grenze+Gothic:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/estilos.css">
</head>
<body>

  <a href="#contenido" class="saltar-contenido">Saltar al contenido principal</a>

  <header class="cabecera">
    <div class="cabecera-interior">
      <a href="index.html" class="logo"><span aria-hidden="true">🪦</span> Noche de Disfraces</a>
      <nav class="menu" aria-label="Menú principal">
        <a href="index.html" class="menu-enlace">Disfraces</a>
        <div class="menu-usuario" data-menu-usuario></div>
      </nav>
    </div>
  </header>

  <main id="contenido" class="admin" tabindex="-1">
    <div class="admin-titulo">
      <h1>Panel de administración</h1>
      <p class="ayuda">Alta, modificación y baja de disfraces. Los eliminados van a la papelera y se pueden restaurar.</p>
    </div>

    <div class="admin-grilla">
      <!-- Formulario de alta / edición -->
      <section class="tarjeta-formulario" aria-labelledby="titulo-form">
        <h2 id="titulo-form" tabindex="-1">Nuevo disfraz</h2>
        <div class="alerta" id="alerta-form" role="status" aria-live="polite" aria-atomic="true" hidden></div>

        <form id="form-disfraz" class="formulario" novalidate>
          <input type="hidden" name="id" id="disfraz-id">
          <div class="campo">
            <label for="disfraz-nombre">Nombre</label>
            <input type="text" id="disfraz-nombre" name="nombre" maxlength="50" required>
          </div>
          <div class="campo">
            <label for="disfraz-descripcion">Descripción</label>
            <textarea id="disfraz-descripcion" name="descripcion" maxlength="1000" rows="4" required></textarea>
          </div>
          <div class="campo campo-foto">
            <label for="disfraz-foto">Foto <span class="opcional">(opcional)</span></label>
            <input type="file" id="disfraz-foto" name="foto" accept="image/jpeg,image/png,image/gif,image/webp">
            <img class="vista-previa" id="disfraz-vista" alt="Foto del disfraz" hidden>
            <label class="casilla" id="casilla-quitar-foto" hidden>
              <input type="checkbox" id="disfraz-quitar-foto"> Quitar la foto actual
            </label>
          </div>
          <div class="formulario-acciones">
            <button type="submit" class="boton boton-principal" id="btn-guardar">Crear disfraz</button>
            <button type="button" class="boton boton-secundario" id="btn-cancelar" hidden>Cancelar edición</button>
          </div>
        </form>
      </section>

      <!-- Listado -->
      <section class="tarjeta-formulario admin-listado" aria-labelledby="titulo-listado">
        <div class="seccion-cabecera">
          <h2 id="titulo-listado" tabindex="-1">Disfraces</h2>
          <p class="estado-carga" id="estado-admin" role="status" aria-live="polite" aria-atomic="true">Cargando…</p>
        </div>
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th scope="col">Foto</th>
                <th scope="col">Disfraz</th>
                <th scope="col">Votos</th>
                <th scope="col">Estado</th>
                <th scope="col"><span class="solo-lector">Acciones</span></th>
              </tr>
            </thead>
            <tbody id="tabla-disfraces"></tbody>
          </table>
        </div>
      </section>
    </div>
  </main>

  <footer class="pie">
    <p><span aria-hidden="true">🕸️</span> Sesión iniciada como administrador</p>
  </footer>

  <script src="js/comun.js"></script>
  <script src="js/admin.js"></script>
</body>
</html>
