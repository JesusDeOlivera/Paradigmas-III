/* =========================================================
   AA25 — Funciones comunes a todas las páginas
   - api():          cliente de la API REST con fetch
   - cargarSesion(): consulta quién está logueado y arma el menú
   - crear():        crea elementos del DOM usando textContent (evita XSS)
   - comprimirImagen(): achica la foto para que entre en la columna BLOB (64 KB)
   ========================================================= */

const Sesion = {
  usuario: null, // { id, nombre, es_admin } o null
};

/* ---------------------------------------------------------
   Cliente de la API REST
   Devuelve { ok, status, datos } y nunca lanza por un 4xx/5xx
   --------------------------------------------------------- */
async function api(url, { metodo = 'GET', json, formData, override } = {}) {
  const opciones = {
    method: metodo,
    credentials: 'same-origin',          // envía la cookie de sesión
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'fetch',       // la API rechaza escrituras sin esta cabecera (CSRF)
    },
  };

  if (json !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(json);
  } else if (formData) {
    opciones.body = formData;            // el navegador arma el multipart/form-data
  }

  if (override) {
    opciones.headers['X-HTTP-Method-Override'] = override; // PUT con archivo viaja como POST
  }

  try {
    const respuesta = await fetch(url, opciones);
    let datos = {};
    try {
      datos = await respuesta.json();
    } catch {
      datos = { mensaje: 'Respuesta inesperada del servidor. ¿Está corriendo Apache con PHP?' };
    }
    return { ok: respuesta.ok && datos.estado === 'exito', status: respuesta.status, datos };
  } catch {
    return {
      ok: false,
      status: 0,
      datos: { mensaje: 'No se pudo conectar con el servidor. Abrí el sitio desde http://localhost/ con XAMPP encendido.' },
    };
  }
}

/* ---------------------------------------------------------
   Sesión y menú
   --------------------------------------------------------- */
async function cargarSesion() {
  const { ok, datos } = await api('api/sesion.php');
  Sesion.usuario = ok && datos.autenticado ? datos.usuario : null;
  pintarMenu();
  return Sesion.usuario;
}

function pintarMenu() {
  const menu = document.querySelector('[data-menu-usuario]');
  if (!menu) return;

  const usuario = Sesion.usuario;
  const items = [];

  if (usuario) {
    const saludo = crear('span', 'menu-saludo');
    saludo.append('Hola, ', crear('strong', '', usuario.nombre)); // textContent: el nombre nunca se interpreta como HTML
    items.push(saludo);

    if (usuario.es_admin) {
      const admin = enlace('admin.php', 'Administrar', 'menu-enlace menu-admin');
      if (window.location.pathname.endsWith('admin.php')) admin.setAttribute('aria-current', 'page');
      items.push(admin);
    }

    const salir = crear('button', 'menu-boton', 'Salir');
    salir.type = 'button';
    salir.addEventListener('click', cerrarSesion);
    items.push(salir);
  } else {
    const ingresar = enlace('login.html', 'Ingresar', 'menu-enlace');
    const registrarme = enlace('registro.html', 'Registrarme', 'menu-enlace menu-destacado');
    // Marca la página actual para el lector de pantalla
    if (window.location.pathname.endsWith('login.html')) ingresar.setAttribute('aria-current', 'page');
    if (window.location.pathname.endsWith('registro.html')) registrarme.setAttribute('aria-current', 'page');
    items.push(ingresar, registrarme);
  }

  menu.replaceChildren(...items);
  document.documentElement.dataset.sesion = usuario ? 'usuario' : 'visitante';
}

async function cerrarSesion() {
  await api('api/logout.php', { metodo: 'POST' });
  window.location.href = 'index.html';
}

/* ---------------------------------------------------------
   DOM seguro
   --------------------------------------------------------- */
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined && texto !== null) elemento.textContent = texto;
  return elemento;
}

function enlace(href, texto, clase) {
  const a = crear('a', clase, texto);
  a.href = href;
  return a;
}

/** Muestra un mensaje en una caja de alerta (tipo: exito | error | info). */
function mostrarMensaje(caja, tipo, texto) {
  if (!caja) return;
  caja.className = `alerta alerta-${tipo}`;
  caja.textContent = texto;
  caja.hidden = false;
}

function ocultarMensaje(caja) {
  if (caja) caja.hidden = true;
}

/** Aviso flotante breve. */
function avisar(texto, tipo = 'info') {
  let aviso = document.querySelector('#aviso-flotante');
  if (!aviso) {
    aviso = crear('div', 'aviso-flotante');
    aviso.id = 'aviso-flotante';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');   // el lector de pantalla anuncia cada aviso
    aviso.setAttribute('aria-atomic', 'true');
    document.body.appendChild(aviso);
  }
  aviso.textContent = texto;
  aviso.dataset.tipo = tipo;
  aviso.classList.add('visible');
  clearTimeout(aviso._temporizador);
  aviso._temporizador = setTimeout(() => aviso.classList.remove('visible'), 3200);
}

/* ---------------------------------------------------------
   Errores de formulario accesibles
   El campo con error se marca con aria-invalid y recibe el foco,
   y el mensaje se anuncia en la región aria-live del formulario.
   --------------------------------------------------------- */
function marcarError(campo) {
  campo.setAttribute('aria-invalid', 'true');
  campo.focus();
}

function limpiarErrores(formulario) {
  formulario.querySelectorAll('[aria-invalid]').forEach((campo) => campo.removeAttribute('aria-invalid'));
}

/** Devuelve el foco a un elemento después de volver a dibujar la página (si sigue existiendo). */
function enfocar(selector) {
  const elemento = document.querySelector(selector);
  if (elemento) elemento.focus();
  return Boolean(elemento);
}

/** Página a la que volver después del login (solo páginas propias: evita redirecciones abiertas). */
function paginaDeVuelta() {
  const permitidas = ['index.html', 'admin.php'];
  const volver = new URLSearchParams(window.location.search).get('volver');
  return permitidas.includes(volver) ? volver : 'index.html';
}

/* ---------------------------------------------------------
   Imágenes
   La columna foto_blob es BLOB (máximo 65.535 bytes). Antes de subir,
   la imagen se redimensiona y se comprime a JPEG hasta que pese menos de 60 KB.
   --------------------------------------------------------- */
const MAX_BYTES_FOTO = 60000;

async function comprimirImagen(archivo) {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo elegido no es una imagen.');
  }

  const imagen = await cargarImagen(archivo);
  let lado = 720;
  let calidad = 0.85;

  for (let intento = 0; intento < 12; intento++) {
    const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(imagen.width * escala);
    canvas.height = Math.round(imagen.height * escala);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1024'; // fondo para imágenes PNG con transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/jpeg', calidad));
    if (blob && blob.size <= MAX_BYTES_FOTO) {
      return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    }

    // Primero baja la calidad; si no alcanza, achica la imagen
    if (calidad > 0.5) {
      calidad -= 0.1;
    } else {
      lado = Math.round(lado * 0.8);
      calidad = 0.75;
    }
  }
  throw new Error('No se pudo achicar la imagen lo suficiente. Probá con otra.');
}

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

/** Muestra una vista previa de la imagen elegida en un <img>. */
function previsualizar(inputArchivo, imgVista) {
  inputArchivo.addEventListener('change', () => {
    const archivo = inputArchivo.files[0];
    if (!archivo) {
      imgVista.hidden = true;
      return;
    }
    if (imgVista.dataset.url) URL.revokeObjectURL(imgVista.dataset.url);
    imgVista.dataset.url = URL.createObjectURL(archivo);
    imgVista.src = imgVista.dataset.url;
    imgVista.hidden = false;
  });
}

/** Deshabilita el botón de envío mientras se espera la respuesta. */
function setCargando(boton, cargando, textoCargando = 'Enviando…') {
  if (!boton.dataset.textoOriginal) boton.dataset.textoOriginal = boton.textContent;
  boton.disabled = cargando;
  boton.textContent = cargando ? textoCargando : boton.dataset.textoOriginal;
}
