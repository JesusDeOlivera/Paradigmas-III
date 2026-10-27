/* =========================================================
   AA25 — Panel de administración: CRUD de disfraces
     Create → POST   api/disfraces.php                 (multipart)
     Read   → GET    api/disfraces.php?todos=1
     Update → PUT    api/disfraces.php?id=X            (multipart + X-HTTP-Method-Override: PUT)
     Delete → DELETE api/disfraces.php?id=X            (papelera)
              DELETE api/disfraces.php?id=X&definitivo=1
   ========================================================= */

const form          = document.querySelector('#form-disfraz');
const alertaForm    = document.querySelector('#alerta-form');
const tituloForm    = document.querySelector('#titulo-form');
const btnGuardar    = document.querySelector('#btn-guardar');
const btnCancelar   = document.querySelector('#btn-cancelar');
const inputFoto     = document.querySelector('#disfraz-foto');
const vistaFoto     = document.querySelector('#disfraz-vista');
const casillaQuitar = document.querySelector('#casilla-quitar-foto');
const tablaCuerpo   = document.querySelector('#tabla-disfraces');
const estadoAdmin   = document.querySelector('#estado-admin');

let disfraces = [];

/* ---------------------------------------------------------
   READ
   --------------------------------------------------------- */
async function cargarTabla() {
  const { ok, status, datos } = await api('api/disfraces.php?todos=1');

  if (status === 401 || status === 403) {
    window.location.href = 'login.html?volver=admin.php'; // la sesión venció
    return;
  }
  if (!ok) {
    estadoAdmin.textContent = datos.mensaje || 'No se pudo cargar el listado.';
    estadoAdmin.classList.add('estado-error');
    return;
  }

  disfraces = datos.data;
  const activos = disfraces.filter((d) => !d.eliminado).length;
  estadoAdmin.classList.remove('estado-error');
  estadoAdmin.textContent = `${activos} visibles · ${disfraces.length - activos} en la papelera`;

  if (!disfraces.length) {
    const fila = crear('tr');
    const celda = crear('td', 'vacio', 'No hay disfraces cargados.');
    celda.colSpan = 5;
    fila.appendChild(celda);
    tablaCuerpo.replaceChildren(fila);
    return;
  }

  tablaCuerpo.replaceChildren(...disfraces.map(crearFila));
}

function crearFila(disfraz) {
  const fila = crear('tr');
  if (disfraz.eliminado) fila.classList.add('fila-eliminada');

  // Foto
  const celdaFoto = crear('td');
  if (disfraz.foto_url) {
    const img = crear('img', 'miniatura');
    img.src = disfraz.foto_url;
    img.alt = '';
    celdaFoto.appendChild(img);
  } else {
    celdaFoto.appendChild(crear('span', 'miniatura miniatura-vacia', '🎭'));
  }

  // Nombre y descripción
  const celdaTexto = crear('td');
  celdaTexto.append(
    crear('strong', 'tabla-nombre', disfraz.nombre),
    crear('span', 'tabla-descripcion', disfraz.descripcion)
  );

  const celdaVotos = crear('td', 'tabla-votos', disfraz.votos);
  const celdaEstado = crear('td');
  celdaEstado.appendChild(crear('span', `etiqueta ${disfraz.eliminado ? 'etiqueta-eliminado' : 'etiqueta-visible'}`,
    disfraz.eliminado ? 'En papelera' : 'Visible'));

  // Acciones
  const celdaAcciones = crear('td', 'tabla-acciones');
  if (disfraz.eliminado) {
    celdaAcciones.append(
      botonAccion('Restaurar', 'restaurar', disfraz.id),
      botonAccion('Borrar definitivamente', 'borrar', disfraz.id, 'peligro')
    );
  } else {
    celdaAcciones.append(
      botonAccion('Editar', 'editar', disfraz.id),
      botonAccion('Eliminar', 'eliminar', disfraz.id, 'peligro')
    );
  }

  fila.append(celdaFoto, celdaTexto, celdaVotos, celdaEstado, celdaAcciones);
  return fila;
}

function botonAccion(texto, accion, id, variante = '') {
  const boton = crear('button', `boton-chico ${variante}`, texto);
  boton.type = 'button';
  boton.dataset.accion = accion;
  boton.dataset.id = id;
  return boton;
}

/* ---------------------------------------------------------
   CREATE / UPDATE
   --------------------------------------------------------- */
async function guardar(evento) {
  evento.preventDefault();

  const id          = form.elements.id.value;
  const nombre      = form.elements.nombre.value.trim();
  const descripcion = form.elements.descripcion.value.trim();
  const archivo     = inputFoto.files[0];

  if (!nombre || !descripcion) {
    mostrarMensaje(alertaForm, 'error', 'El nombre y la descripción son obligatorios.');
    return;
  }

  setCargando(btnGuardar, true, 'Guardando…');

  try {
    const datos = new FormData();
    datos.append('nombre', nombre);
    datos.append('descripcion', descripcion);
    if (archivo) {
      mostrarMensaje(alertaForm, 'info', 'Preparando la foto…');
      datos.append('foto', await comprimirImagen(archivo));
    }
    if (id && document.querySelector('#disfraz-quitar-foto').checked) {
      datos.append('quitar_foto', '1');
    }

    const respuesta = id
      ? await api(`api/disfraces.php?id=${id}`, { metodo: 'POST', override: 'PUT', formData: datos })
      : await api('api/disfraces.php', { metodo: 'POST', formData: datos });

    if (respuesta.ok) {
      avisar(respuesta.datos.mensaje, 'exito');
      reiniciarFormulario();
      await cargarTabla();
    } else {
      mostrarMensaje(alertaForm, 'error', respuesta.datos.mensaje || 'No se pudo guardar.');
    }
  } catch (error) {
    mostrarMensaje(alertaForm, 'error', error.message);
  } finally {
    setCargando(btnGuardar, false);
  }
}

function editar(id) {
  const disfraz = disfraces.find((d) => d.id === id);
  if (!disfraz) return;

  form.elements.id.value = disfraz.id;
  form.elements.nombre.value = disfraz.nombre;
  form.elements.descripcion.value = disfraz.descripcion;
  inputFoto.value = '';
  document.querySelector('#disfraz-quitar-foto').checked = false;

  if (disfraz.foto_url) {
    vistaFoto.src = disfraz.foto_url;
    vistaFoto.hidden = false;
    casillaQuitar.hidden = false;
  } else {
    vistaFoto.hidden = true;
    casillaQuitar.hidden = true;
  }

  tituloForm.textContent = `Editar: ${disfraz.nombre}`;
  btnGuardar.textContent = 'Guardar cambios';
  btnGuardar.dataset.textoOriginal = 'Guardar cambios';
  btnCancelar.hidden = false;
  ocultarMensaje(alertaForm);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.nombre.focus();
}

function reiniciarFormulario() {
  form.reset();
  form.elements.id.value = '';
  vistaFoto.hidden = true;
  casillaQuitar.hidden = true;
  tituloForm.textContent = 'Nuevo disfraz';
  btnGuardar.textContent = 'Crear disfraz';
  btnGuardar.dataset.textoOriginal = 'Crear disfraz';
  btnCancelar.hidden = true;
  ocultarMensaje(alertaForm);
}

/* ---------------------------------------------------------
   DELETE / restaurar
   --------------------------------------------------------- */
async function ejecutarAccion(accion, id) {
  const disfraz = disfraces.find((d) => d.id === id);
  if (!disfraz) return;

  let respuesta;
  if (accion === 'eliminar') {
    if (!confirm(`¿Enviar "${disfraz.nombre}" a la papelera?`)) return;
    respuesta = await api(`api/disfraces.php?id=${id}`, { metodo: 'DELETE' });
  } else if (accion === 'restaurar') {
    respuesta = await api(`api/disfraces.php?id=${id}`, { metodo: 'PUT', json: { eliminado: 0 } });
  } else if (accion === 'borrar') {
    if (!confirm(`¿Borrar "${disfraz.nombre}" para siempre? También se borran sus votos.`)) return;
    respuesta = await api(`api/disfraces.php?id=${id}&definitivo=1`, { metodo: 'DELETE' });
  } else {
    return;
  }

  if (respuesta.ok) {
    avisar(accion === 'restaurar' ? 'Disfraz restaurado.' : respuesta.datos.mensaje, 'exito');
    if (Number(form.elements.id.value) === id) reiniciarFormulario();
    await cargarTabla();
  } else {
    avisar(respuesta.datos.mensaje || 'No se pudo completar la acción.', 'error');
  }
}

/* ---------------------------------------------------------
   Eventos e inicio
   --------------------------------------------------------- */
form.addEventListener('submit', guardar);
btnCancelar.addEventListener('click', reiniciarFormulario);
previsualizar(inputFoto, vistaFoto);

// Delegación de eventos en la tabla
tablaCuerpo.addEventListener('click', (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton) return;
  const id = Number(boton.dataset.id);
  if (boton.dataset.accion === 'editar') editar(id);
  else ejecutarAccion(boton.dataset.accion, id);
});

document.addEventListener('DOMContentLoaded', async () => {
  await cargarSesion();
  await cargarTabla();
});
