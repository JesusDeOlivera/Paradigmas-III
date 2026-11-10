/* =========================================================
   AA25 — Página principal: ranking, votación y subida de disfraces
   ========================================================= */

const grilla      = document.querySelector('#grilla-disfraces');
const estadoCarga = document.querySelector('#estado-carga');
const formSubir   = document.querySelector('#form-subir');
const alertaSubir = document.querySelector('#alerta-subir');

const MEDALLAS = ['🥇', '🥈', '🥉'];

/* ---------------------------------------------------------
   Vista según la sesión (visitante / usuario)
   --------------------------------------------------------- */
function aplicarVista() {
  const audiencia = Sesion.usuario ? 'usuario' : 'visitante';
  document.querySelectorAll('[data-vista]').forEach((el) => {
    el.hidden = el.dataset.vista !== audiencia;
  });
}

/* ---------------------------------------------------------
   GET api/disfraces.php → tarjetas
   --------------------------------------------------------- */
async function cargarDisfraces() {
  const { ok, datos } = await api('api/disfraces.php');
  grilla.setAttribute('aria-busy', 'false');

  if (!ok) {
    estadoCarga.textContent = datos.mensaje || 'No se pudieron cargar los disfraces.';
    estadoCarga.classList.add('estado-error');
    return;
  }

  estadoCarga.classList.remove('estado-error');
  estadoCarga.textContent = datos.total === 1 ? '1 disfraz en competencia' : `${datos.total} disfraces en competencia`;

  if (datos.total === 0) {
    grilla.replaceChildren(crear('p', 'vacio', 'Todavía no hay disfraces. ¡Subí el primero!'));
    return;
  }

  grilla.replaceChildren(...datos.data.map(crearTarjeta));
}

function crearTarjeta(disfraz, posicion) {
  const tarjeta = crear('article', 'tarjeta-disfraz');
  tarjeta.dataset.id = disfraz.id;
  tarjeta.setAttribute('aria-labelledby', `titulo-disfraz-${disfraz.id}`);
  if (posicion < 3 && disfraz.votos > 0) tarjeta.classList.add('podio');

  // Foto
  const figura = crear('figure', 'tarjeta-foto');
  if (disfraz.foto_url) {
    const img = crear('img');
    img.src = disfraz.foto_url;
    img.alt = `Foto del disfraz ${disfraz.nombre}`;
    img.loading = 'lazy';
    figura.appendChild(img);
  } else {
    figura.appendChild(crear('span', 'sin-foto', '🎭'));
  }
  // Puesto en el ranking: la medalla es decorativa y el lector de pantalla lee "Puesto 1"
  const puesto = crear('span', 'puesto');
  const simbolo = crear('span', '', posicion < 3 && disfraz.votos > 0 ? MEDALLAS[posicion] : `#${posicion + 1}`);
  simbolo.setAttribute('aria-hidden', 'true');
  puesto.append(simbolo, crear('span', 'solo-lector', `Puesto ${posicion + 1}`));
  figura.appendChild(puesto);

  // Texto (siempre con textContent: lo que escriben los usuarios nunca se ejecuta como HTML)
  const cuerpo = crear('div', 'tarjeta-cuerpo');
  const titulo = crear('h3', 'tarjeta-titulo', disfraz.nombre);
  titulo.id = `titulo-disfraz-${disfraz.id}`;
  cuerpo.append(
    titulo,
    crear('p', 'tarjeta-descripcion', disfraz.descripcion)
  );

  // Votos + botón
  const pie = crear('div', 'tarjeta-pie');
  const contador = crear('p', 'contador-votos');
  contador.append(crear('strong', 'contador-numero', disfraz.votos), disfraz.votos === 1 ? ' voto' : ' votos');

  const boton = crear('button', 'boton-votar');
  boton.type = 'button';
  boton.dataset.id = disfraz.id;
  boton.dataset.nombre = disfraz.nombre;
  actualizarBoton(boton, disfraz.votado);

  pie.append(contador, boton);
  cuerpo.appendChild(pie);
  tarjeta.append(figura, cuerpo);
  return tarjeta;
}

function actualizarBoton(boton, votado) {
  boton.dataset.votado = votado ? '1' : '0';
  boton.classList.toggle('votado', votado);
  boton.setAttribute('aria-pressed', String(votado));

  // El emoji es decorativo; el texto oculto aclara de qué disfraz es cada botón.
  // Nombre accesible: "Votar por Calabaza gigante" / "Votado. Quitar voto de Calabaza gigante"
  const icono = crear('span', '', votado ? '✓' : '🕯️');
  icono.setAttribute('aria-hidden', 'true');
  const extra = crear('span', 'solo-lector', votado
    ? `. Quitar voto de ${boton.dataset.nombre}`
    : ` por ${boton.dataset.nombre}`);
  boton.replaceChildren(icono, ` ${votado ? 'Votado' : 'Votar'}`, extra);
  boton.title = votado ? 'Tocá para quitar tu voto' : 'Votar este disfraz';
}

/* ---------------------------------------------------------
   Votar / quitar voto
   POST api/votos.php   ·   DELETE api/votos.php?id_disfraz=X
   --------------------------------------------------------- */
async function manejarVoto(boton) {
  // Solo los usuarios registrados pueden votar
  if (!Sesion.usuario) {
    avisar('Iniciá sesión para votar. Te llevamos al ingreso…', 'info');
    setTimeout(() => { window.location.href = 'login.html?volver=index.html'; }, 1400);
    return;
  }

  const id = Number(boton.dataset.id);
  const yaVotado = boton.dataset.votado === '1';
  boton.disabled = true;

  const { ok, status, datos } = yaVotado
    ? await api(`api/votos.php?id_disfraz=${id}`, { metodo: 'DELETE' })
    : await api('api/votos.php', { metodo: 'POST', json: { id_disfraz: id } });

  boton.disabled = false;

  if (status === 401) {
    // La sesión venció en el servidor
    Sesion.usuario = null;
    pintarMenu();
    aplicarVista();
    avisar('Tu sesión venció. Volvé a ingresar para votar.', 'error');
    return;
  }

  if (!ok) {
    avisar(datos.mensaje || 'No se pudo registrar el voto.', 'error');
    if (status === 409) actualizarBoton(boton, true); // ya había votado
    return;
  }

  avisar(datos.mensaje, 'exito');
  await cargarDisfraces(); // recarga el ranking con los votos actualizados

  // Al volver a dibujar la lista el botón anterior desaparece y el foco se iría al <body>.
  // Se devuelve el foco al botón del mismo disfraz para que quien usa teclado no pierda su lugar.
  enfocar(`.tarjeta-disfraz[data-id="${id}"] .boton-votar`);
}

/* ---------------------------------------------------------
   Subir disfraz: POST api/disfraces.php (multipart/form-data)
   --------------------------------------------------------- */
async function manejarSubida(evento) {
  evento.preventDefault();
  const boton = formSubir.querySelector('button[type="submit"]');
  const nombre = formSubir.elements.nombre.value.trim();
  const descripcion = formSubir.elements.descripcion.value.trim();
  const archivo = formSubir.elements.foto.files[0];

  limpiarErrores(formSubir);
  const faltante = !nombre ? formSubir.elements.nombre
    : !descripcion ? formSubir.elements.descripcion
    : !archivo ? formSubir.elements.foto : null;
  if (faltante) {
    mostrarMensaje(alertaSubir, 'error', 'Completá el nombre, la descripción y elegí una foto.');
    marcarError(faltante);
    return;
  }

  setCargando(boton, true, 'Subiendo…');
  mostrarMensaje(alertaSubir, 'info', 'Preparando la foto…');

  try {
    const foto = await comprimirImagen(archivo);

    const datosFormulario = new FormData();
    datosFormulario.append('nombre', nombre);
    datosFormulario.append('descripcion', descripcion);
    datosFormulario.append('foto', foto);

    const { ok, datos } = await api('api/disfraces.php', { metodo: 'POST', formData: datosFormulario });

    if (ok) {
      mostrarMensaje(alertaSubir, 'exito', datos.mensaje);
      formSubir.reset();
      document.querySelector('#subir-vista').hidden = true;
      await cargarDisfraces();
    } else {
      mostrarMensaje(alertaSubir, 'error', datos.mensaje || 'No se pudo publicar el disfraz.');
    }
  } catch (error) {
    mostrarMensaje(alertaSubir, 'error', error.message);
  } finally {
    setCargando(boton, false);
  }
}

/* ---------------------------------------------------------
   Eventos e inicio
   --------------------------------------------------------- */
// Delegación: un solo listener para todos los botones "Votar" (también los que se crean después)
grilla.addEventListener('click', (evento) => {
  const boton = evento.target.closest('.boton-votar');
  if (boton && !boton.disabled) manejarVoto(boton);
});

formSubir.addEventListener('submit', manejarSubida);
previsualizar(document.querySelector('#subir-foto'), document.querySelector('#subir-vista'));

document.addEventListener('DOMContentLoaded', async () => {
  await cargarSesion();
  aplicarVista();
  await cargarDisfraces();
});
