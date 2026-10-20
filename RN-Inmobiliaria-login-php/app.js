/* =========================================================
   RN Inmobiliaria — app.js
   Módulo de Registro y Autenticación de Usuarios (con backend PHP)

   Evolución del módulo:
   1. Desacoplamiento: todos los eventos se capturan con addEventListener
      (el HTML no tiene atributos onclick / onsubmit).
   2. Autenticación REAL contra la API PHP + MySQL con fetch() + async/await:
        POST api/registro.php      → alta con hash BCRYPT
        POST api/login.php         → password_verify + session_start()
        POST api/logout.php        → destruye la sesión
        GET  api/perfil.php        → endpoint privado: 200 con sesión / 401 sin sesión
        GET/POST api/mis_favoritos.php → favoritas del usuario (privado, 401 sin sesión)
      El estado de la sesión lo guarda el SERVIDOR ($_SESSION) en una cookie
      HttpOnly; el navegador ya no guarda usuarios ni contraseñas.
   3. VSDM: la visibilidad de cada elemento depende de la audiencia
      (visitante vs. usuario autenticado) mediante el atributo data-vista.
      Al cargar la página se consulta api/perfil.php para decidirla.
   4. XSS: todo dato que viene del servidor (nombre, e-mail, títulos) se
      pinta con textContent, nunca con innerHTML.

   Galería Interactiva y Modo Oscuro/Claro:
   5. Las propiedades destacadas se cargan con fetch() desde
      data/propiedades.json y se filtran / resaltan con classList.toggle().
   6. El tema visual se alterna con classList.toggle('tema-oscuro').
   ========================================================= */

const API = {
  registro: 'api/registro.php',
  login: 'api/login.php',
  logout: 'api/logout.php',
  perfil: 'api/perfil.php',
  favoritos: 'api/mis_favoritos.php',
};
const CLAVE_TEMA = 'rn-tema';
const URL_PROPIEDADES = 'data/propiedades.json';
const LONGITUD_MINIMA = 8;

/* ---------------------------------------------------------
   Estado de la sesión (fuente de verdad: el servidor)
   --------------------------------------------------------- */
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

let sesionActual = null;     // { id, nombre, email, rol } o null
let favoritosActuales = [];  // ids de propiedades favoritas del usuario

function obtenerSesion() {
  return sesionActual;
}

/* ---------------------------------------------------------
   Cliente HTTP de la API
   --------------------------------------------------------- */
// Hace la petición y devuelve { status, ok, datos } sin lanzar error por 4xx/5xx
async function llamarApi(url, opciones = {}) {
  const config = {
    credentials: 'same-origin', // envía la cookie de sesión
    headers: { Accept: 'application/json' },
    ...opciones,
  };
  if (opciones.body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(opciones.body);
  }

  const respuesta = await fetch(url, config);
  let datos = {};
  try {
    datos = await respuesta.json();
  } catch {
    /* respuesta sin JSON (por ej. PHP no está corriendo) */
  }
  return { status: respuesta.status, ok: respuesta.ok && datos.estado === 'exito', datos };
}

// GET api/perfil.php → 200 = usuario autenticado / 401 = visitante
async function comprobarSesion() {
  try {
    const { ok, datos } = await llamarApi(API.perfil);
    sesionActual = ok ? datos.data : null;
  } catch (error) {
    sesionActual = null;
    console.error('No se pudo consultar la sesión:', error);
  }

  if (sesionActual) {
    await cargarFavoritos();
  } else {
    favoritosActuales = [];
  }
  aplicarVista();
}

// POST api/login.php
async function verificarCredenciales(email, password) {
  const { ok, datos } = await llamarApi(API.login, { method: 'POST', body: { email, password } });
  return ok
    ? { ok: true, usuario: datos.usuario }
    : { ok: false, mensaje: datos.mensaje || 'El e-mail o la contraseña no son correctos.' };
}

// POST api/registro.php
async function registrarUsuario(nombre, email, password) {
  const { ok, status, datos } = await llamarApi(API.registro, { method: 'POST', body: { nombre, email, password } });
  return ok
    ? { ok: true, usuario: datos.usuario }
    : { ok: false, status, mensaje: datos.mensaje || 'No pudimos crear la cuenta.' };
}

// POST api/logout.php
async function cerrarSesion() {
  try {
    await llamarApi(API.logout, { method: 'POST' });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
  sesionActual = null;
  favoritosActuales = [];
}

/* ---------------------------------------------------------
   VSDM: aplicar la vista según la audiencia
   --------------------------------------------------------- */
function aplicarVista() {
  const sesion = obtenerSesion();
  const audiencia = sesion ? 'usuario' : 'visitante';

  document.documentElement.dataset.audiencia = audiencia;

  // Alterna el DOM: muestra u oculta botones, menús y formularios según la sesión
  document.querySelectorAll('[data-vista]').forEach((el) => {
    el.hidden = el.dataset.vista !== audiencia;
  });

  if (sesion) {
    // textContent: si el nombre trae <script>, se muestra como texto y no se ejecuta
    document.querySelectorAll('[data-usuario-nombre]').forEach((el) => {
      el.textContent = sesion.nombre.split(' ')[0];
    });
    document.querySelectorAll('[data-usuario-email]').forEach((el) => {
      el.textContent = sesion.email;
    });
    document.querySelectorAll('[data-usuario-rol]').forEach((el) => {
      el.textContent = sesion.rol === 'agente' ? 'Agente inmobiliario' : 'Cliente';
    });
  }

  actualizarFavoritos();
  precargarFormularioCompra();
}

/* ---------------------------------------------------------
   Respuesta visual y validación de campos
   --------------------------------------------------------- */
function mostrarAlerta(tipo, mensaje) {
  const alerta = document.getElementById('auth-alerta');
  if (!alerta) return;
  alerta.className = `form-alerta form-alerta--${tipo}`;
  alerta.textContent = mensaje;
  alerta.hidden = false;
}

function ocultarAlerta() {
  const alerta = document.getElementById('auth-alerta');
  if (alerta) alerta.hidden = true;
}

function marcarError(input, mensaje) {
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', 'true');
  if (error) {
    error.textContent = mensaje;
    input.setAttribute('aria-describedby', error.id);
  }
}

function limpiarErrores(form) {
  form.querySelectorAll('input').forEach((input) => {
    input.removeAttribute('aria-invalid');
    const error = document.getElementById(`${input.id}-error`);
    if (error) error.textContent = '';
  });
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setCargando(form, cargando, textoCargando) {
  const boton = form.querySelector('button[type="submit"]');
  if (!boton.dataset.textoOriginal) boton.dataset.textoOriginal = boton.textContent;
  boton.disabled = cargando;
  boton.textContent = cargando ? textoCargando : boton.dataset.textoOriginal;
}

/* ---------------------------------------------------------
   Manejadores de formularios (interceptan el submit)
   --------------------------------------------------------- */
async function manejarLogin(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const email = form.elements.email;
  const password = form.elements.password;

  limpiarErrores(form);
  ocultarAlerta();

  let valido = true;
  if (!emailValido(email.value.trim())) {
    marcarError(email, 'Ingresá un e-mail válido.');
    valido = false;
  }
  if (password.value.length < LONGITUD_MINIMA) {
    marcarError(password, `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
    valido = false;
  }
  if (!valido) {
    mostrarAlerta('error', 'Revisá los campos marcados.');
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }

  setCargando(form, true, 'Verificando…');
  mostrarAlerta('cargando', 'Verificando credenciales con el servidor…');

  try {
    const resultado = await verificarCredenciales(email.value.trim(), password.value);
    if (resultado.ok) {
      // La sesión ya quedó abierta en el servidor ($_SESSION + cookie HttpOnly).
      // mostrarAlerta usa textContent: el nombre nunca se interpreta como HTML.
      mostrarAlerta('exito', `¡Bienvenido/a, ${resultado.usuario.nombre}! Sesión iniciada.`);
      form.reset();
      await esperar(1200);
      await comprobarSesion(); // confirma contra el endpoint privado y alterna el DOM
    } else {
      mostrarAlerta('error', resultado.mensaje);
      password.value = '';
      password.focus();
    }
  } catch (error) {
    mostrarAlerta('error', 'No pudimos conectar con el servidor. Abrí el sitio desde XAMPP (http://localhost/...) con Apache y MySQL encendidos.');
    console.error('Error al verificar credenciales:', error);
  } finally {
    setCargando(form, false);
  }
}

async function manejarRegistro(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const { nombre, email, password, password2 } = form.elements;

  limpiarErrores(form);
  ocultarAlerta();

  let valido = true;
  if (nombre.value.trim().length < 3) {
    marcarError(nombre, 'Ingresá tu nombre completo.');
    valido = false;
  }
  if (!emailValido(email.value.trim())) {
    marcarError(email, 'Ingresá un e-mail válido.');
    valido = false;
  }
  if (password.value.length < LONGITUD_MINIMA) {
    marcarError(password, `Mínimo ${LONGITUD_MINIMA} caracteres.`);
    valido = false;
  }
  if (password2.value !== password.value) {
    marcarError(password2, 'Las contraseñas no coinciden.');
    valido = false;
  }
  if (!valido) {
    mostrarAlerta('error', 'Revisá los campos marcados.');
    form.querySelector('[aria-invalid="true"]').focus();
    return;
  }

  setCargando(form, true, 'Creando cuenta…');
  mostrarAlerta('cargando', 'Enviando datos al servidor…');

  try {
    const resultado = await registrarUsuario(nombre.value.trim(), email.value.trim(), password.value);
    if (resultado.ok) {
      mostrarAlerta('exito', `¡Cuenta creada! Bienvenido/a, ${resultado.usuario.nombre}.`);
      form.reset();
      await esperar(1200);
      await comprobarSesion();
    } else {
      mostrarAlerta('error', resultado.mensaje);
      if (resultado.status === 409) { // e-mail ya registrado
        marcarError(email, resultado.mensaje);
        email.focus();
      }
    }
  } catch (error) {
    mostrarAlerta('error', 'No pudimos conectar con el servidor. Abrí el sitio desde XAMPP (http://localhost/...) con Apache y MySQL encendidos.');
    console.error('Error al registrar usuario:', error);
  } finally {
    setCargando(form, false);
  }
}

/* ---------------------------------------------------------
   Pestañas Ingresar / Crear cuenta
   --------------------------------------------------------- */
function activarPestana(nombre) {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    const activa = tab.dataset.tab === nombre;
    tab.classList.toggle('is-activa', activa);
    tab.setAttribute('aria-selected', String(activa));
  });
  document.getElementById('panel-login').hidden = nombre !== 'login';
  document.getElementById('panel-registro').hidden = nombre !== 'registro';
  ocultarAlerta();
}

/* ---------------------------------------------------------
   Favoritos (solo para usuarios autenticados)
   Se guardan en MySQL a través del endpoint privado api/mis_favoritos.php
   --------------------------------------------------------- */
function idPropiedad(boton) {
  const card = boton.closest('.card-propiedad');
  return card ? card.dataset.id || '' : '';
}

// GET api/mis_favoritos.php
async function cargarFavoritos() {
  try {
    const { status, ok, datos } = await llamarApi(API.favoritos);
    if (status === 401) {          // la sesión venció en el servidor
      sesionActual = null;
      favoritosActuales = [];
      return;
    }
    favoritosActuales = ok ? datos.data.map((p) => p.id) : [];
    renderizarMisFavoritas(ok ? datos.data : []);
  } catch (error) {
    favoritosActuales = [];
    console.error('No se pudieron cargar los favoritos:', error);
  }
}

function actualizarFavoritos() {
  const favoritos = obtenerSesion() ? favoritosActuales : [];
  document.querySelectorAll('.btn-favorito').forEach((boton) => {
    const marcado = favoritos.includes(idPropiedad(boton));
    boton.classList.toggle('is-activo', marcado);
    boton.setAttribute('aria-pressed', String(marcado));
    boton.setAttribute('aria-label', marcado ? 'Quitar de favoritos' : 'Agregar a favoritos');
  });
}

// POST api/mis_favoritos.php (agrega o quita)
async function manejarFavorito(boton) {
  // VSDM: el visitante no puede guardar favoritos, se lo invita a ingresar
  if (!obtenerSesion()) {
    mostrarAviso('Ingresá a tu cuenta para guardar propiedades favoritas.', 'acceso.html', 'Ingresar');
    return;
  }

  boton.disabled = true;
  try {
    const { status, ok, datos } = await llamarApi(API.favoritos, {
      method: 'POST',
      body: { propiedad_id: idPropiedad(boton) },
    });

    if (status === 401) {
      // El servidor rechazó la petición: la sesión ya no es válida
      sesionActual = null;
      favoritosActuales = [];
      aplicarVista();
      mostrarAviso('Tu sesión venció. Volvé a ingresar para guardar favoritas.', 'acceso.html', 'Ingresar');
      return;
    }
    if (!ok) {
      mostrarAviso(datos.mensaje || 'No pudimos guardar el favorito.');
      return;
    }

    favoritosActuales = datos.data.map((p) => p.id);
    actualizarFavoritos();
    renderizarMisFavoritas(datos.data);
    mostrarAviso(datos.mensaje);
  } catch (error) {
    mostrarAviso('No pudimos conectar con el servidor.');
    console.error('Error al guardar favorito:', error);
  } finally {
    boton.disabled = false;
  }
}

// Lista "Mis propiedades favoritas" del panel de cuenta (acceso.html)
function renderizarMisFavoritas(lista) {
  const contenedor = document.getElementById('mis-favoritas');
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.replaceChildren(crear('li', 'mis-favoritas-vacio',
      'Todavía no guardaste propiedades. Tocá el ♥ en cualquier tarjeta.'));
    return;
  }

  // Renderizado seguro: cada dato se asigna con textContent (función crear)
  contenedor.replaceChildren(...lista.map((p) => {
    const item = crear('li', 'mis-favoritas-item');
    const enlace = crear('a', '', p.titulo);
    enlace.href = p.ficha;
    item.append(
      enlace,
      crear('span', 'mis-favoritas-detalle', `${p.barrio} · USD ${formatoPrecio.format(p.precio)}`)
    );
    return item;
  }));
}

/* Aviso flotante reutilizable */
function mostrarAviso(texto, href, textoEnlace) {
  let aviso = document.getElementById('rn-aviso');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'rn-aviso';
    aviso.className = 'aviso-flotante';
    aviso.setAttribute('role', 'status');
    document.body.appendChild(aviso);
  }
  aviso.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = texto;
  aviso.appendChild(p);
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'btn btn-primary btn-sm';
    a.textContent = textoEnlace;
    aviso.appendChild(a);
  }
  aviso.classList.add('is-visible');
  clearTimeout(aviso._timer);
  aviso._timer = setTimeout(() => aviso.classList.remove('is-visible'), 4000);
}

/* ---------------------------------------------------------
   Formulario de compra: datos precargados para el usuario
   --------------------------------------------------------- */
function precargarFormularioCompra() {
  const form = document.querySelector('.comprar-form');
  const sesion = obtenerSesion();
  if (!form || !sesion) return;
  if (form.elements.nombre && !form.elements.nombre.value) form.elements.nombre.value = sesion.nombre;
  if (form.elements.email && !form.elements.email.value) form.elements.email.value = sesion.email;
}

/* ---------------------------------------------------------
   Tema claro / oscuro
   --------------------------------------------------------- */
function temaGuardado() {
  try {
    return localStorage.getItem(CLAVE_TEMA);
  } catch {
    return null;
  }
}

function prefiereOscuro() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Se ejecuta apenas carga el script para evitar un "parpadeo" de tema
function aplicarTemaInicial() {
  const guardado = temaGuardado();
  const oscuro = guardado ? guardado === 'oscuro' : prefiereOscuro();
  document.documentElement.classList.toggle('tema-oscuro', oscuro);
}

function actualizarBotonTema() {
  const oscuro = document.documentElement.classList.contains('tema-oscuro');
  document.querySelectorAll('[data-accion="alternar-tema"]').forEach((boton) => {
    boton.setAttribute('aria-pressed', String(oscuro));
    boton.setAttribute('aria-label', oscuro ? 'Activar modo claro' : 'Activar modo oscuro');
    boton.title = oscuro ? 'Modo claro' : 'Modo oscuro';
    boton.querySelector('.btn-tema-icono').textContent = oscuro ? '☀' : '☾';
  });
}

function alternarTema() {
  // classList.toggle devuelve true si la clase quedó agregada
  const oscuro = document.documentElement.classList.toggle('tema-oscuro');
  try {
    localStorage.setItem(CLAVE_TEMA, oscuro ? 'oscuro' : 'claro');
  } catch {
    /* sin persistencia: el tema vale solo para esta página */
  }
  actualizarBotonTema();
}

aplicarTemaInicial();

/* ---------------------------------------------------------
   Galería interactiva: propiedades destacadas vía fetch()
   --------------------------------------------------------- */
let propiedades = [];
const formatoPrecio = new Intl.NumberFormat('es-AR');

function crear(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function crearTarjeta(propiedad) {
  const card = crear('article', 'card-propiedad');
  card.dataset.tipo = propiedad.tipo;
  card.dataset.id = propiedad.id;
  card.classList.toggle('es-destacada', propiedad.destacada);

  // Galería deslizable de la tarjeta
  const galeria = crear('div', 'card-galeria');
  const scroll = crear('div', 'card-galeria-scroll');
  propiedad.fotos.forEach((foto) => {
    const img = crear('img');
    img.src = foto.src;
    img.alt = foto.alt;
    img.loading = 'lazy';
    scroll.appendChild(img);
  });
  const verFotos = crear('button', 'btn-ver-fotos',
    propiedad.fotos.length > 1 ? `Ver ${propiedad.fotos.length} fotos` : 'Ver foto');
  verFotos.type = 'button';
  verFotos.dataset.propiedad = propiedad.id;
  galeria.append(scroll, verFotos);

  const tipo = propiedad.tipo === 'casa' ? 'Casa' : 'Terreno';
  const badge = crear('span', 'badge', tipo);

  const favorito = crear('button', 'btn-favorito', '♥');
  favorito.type = 'button';
  favorito.setAttribute('aria-label', 'Agregar a favoritos');

  const contenido = crear('div', 'card-contenido');
  const meta = crear('div', 'card-meta');
  meta.appendChild(crear('span', '', `${propiedad.superficie} m²`));
  if (propiedad.ambientes) meta.appendChild(crear('span', '', `${propiedad.ambientes} ambientes`));
  const ficha = crear('a', 'btn btn-outline btn-sm card-ver-ficha', 'Ver ficha');
  ficha.href = propiedad.ficha;
  contenido.append(
    crear('h3', '', propiedad.titulo),
    crear('p', 'card-ubicacion', propiedad.barrio),
    crear('p', 'card-precio', `USD ${formatoPrecio.format(propiedad.precio)}`),
    meta,
    ficha
  );

  card.append(galeria, badge, favorito, contenido);
  if (propiedad.destacada) card.appendChild(crear('span', 'cinta-destacada', '★ Destacada'));
  return card;
}

function actualizarEstadoGaleria() {
  const estado = document.getElementById('galeria-estado');
  const tarjetas = document.querySelectorAll('#galeria-destacadas .card-propiedad');
  const visibles = [...tarjetas].filter((t) => !t.classList.contains('is-oculta')).length;
  estado.classList.remove('is-error');
  estado.textContent = `Mostrando ${visibles} de ${tarjetas.length} propiedades.`;
}

async function cargarGaleria() {
  const grilla = document.getElementById('galeria-destacadas');
  const estado = document.getElementById('galeria-estado');
  try {
    const respuesta = await fetch(URL_PROPIEDADES, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    propiedades = datos.propiedades;

    grilla.replaceChildren(...propiedades.map(crearTarjeta));
    actualizarEstadoGaleria();
    actualizarFavoritos();
  } catch (error) {
    estado.classList.add('is-error');
    estado.textContent = 'No pudimos cargar las propiedades. Abrí el sitio desde XAMPP (http://localhost/...).';
    console.error('Error al cargar la galería:', error);
  } finally {
    grilla.removeAttribute('aria-busy');
  }
}

function filtrarGaleria(filtro) {
  document.querySelectorAll('[data-filtro]').forEach((boton) => {
    const activo = boton.dataset.filtro === filtro;
    boton.classList.toggle('is-activo', activo);
    boton.setAttribute('aria-pressed', String(activo));
  });
  document.querySelectorAll('#galeria-destacadas .card-propiedad').forEach((card) => {
    card.classList.toggle('is-oculta', filtro !== 'todas' && card.dataset.tipo !== filtro);
  });
  actualizarEstadoGaleria();
}

function alternarResaltado(evento) {
  const boton = evento.currentTarget;
  const activo = document.getElementById('galeria-destacadas').classList.toggle('modo-resaltado');
  boton.classList.toggle('is-activo', activo);
  boton.setAttribute('aria-pressed', String(activo));
}

/* ---------------------------------------------------------
   Visor de fotos (contexto de navegación "fotos de una propiedad")
   --------------------------------------------------------- */
const visor = { propiedad: null, indice: 0 };

function mostrarFotoVisor() {
  const { propiedad, indice } = visor;
  const foto = propiedad.fotos[indice];
  const imagen = document.getElementById('visor-imagen');
  imagen.src = foto.src;
  imagen.alt = foto.alt;
  document.getElementById('visor-leyenda').textContent = foto.alt;
  document.getElementById('visor-contador').textContent = `${indice + 1} / ${propiedad.fotos.length}`;
  document.querySelector('[data-visor="anterior"]').disabled = indice === 0;
  document.querySelector('[data-visor="siguiente"]').disabled = indice === propiedad.fotos.length - 1;
}

function abrirVisor(id) {
  const propiedad = propiedades.find((p) => p.id === id);
  if (!propiedad) return;
  visor.propiedad = propiedad;
  visor.indice = 0;
  document.getElementById('visor-titulo').textContent = propiedad.titulo;
  mostrarFotoVisor();
  document.getElementById('visor').showModal();
}

function moverVisor(paso) {
  const nuevo = visor.indice + paso;
  if (nuevo < 0 || nuevo >= visor.propiedad.fotos.length) return;
  visor.indice = nuevo;
  mostrarFotoVisor();
}

function iniciarVisor() {
  const dialogo = document.getElementById('visor');
  dialogo.querySelector('[data-visor="cerrar"]').addEventListener('click', () => dialogo.close());
  dialogo.querySelector('[data-visor="anterior"]').addEventListener('click', () => moverVisor(-1));
  dialogo.querySelector('[data-visor="siguiente"]').addEventListener('click', () => moverVisor(1));
  dialogo.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowLeft') moverVisor(-1);
    if (evento.key === 'ArrowRight') moverVisor(1);
  });
  // Click en el fondo oscuro (fuera del contenido) cierra el visor
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });
}

/* ---------------------------------------------------------
   Inicialización: registro de eventos (desacoplado del HTML)
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');

  if (formLogin) formLogin.addEventListener('submit', manejarLogin);
  if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);

  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => activarPestana(tab.dataset.tab));
  });

  document.querySelectorAll('[data-accion="cerrar-sesion"]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      await cerrarSesion();   // POST api/logout.php
      aplicarVista();
      mostrarAviso('Cerraste sesión. ¡Te esperamos pronto!');
    });
  });

  // Delegación: sirve también para las tarjetas que se crean después con fetch()
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('.btn-favorito');
    if (boton) manejarFavorito(boton);
  });

  // Conmutador de tema claro / oscuro
  document.querySelectorAll('[data-accion="alternar-tema"]').forEach((boton) => {
    boton.addEventListener('click', alternarTema);
  });
  actualizarBotonTema();

  // Galería interactiva (solo existe en index.html)
  const galeria = document.getElementById('galeria-destacadas');
  if (galeria) {
    document.querySelectorAll('[data-filtro]').forEach((boton) => {
      boton.addEventListener('click', () => filtrarGaleria(boton.dataset.filtro));
    });
    document.querySelector('[data-accion="resaltar-destacadas"]')
      .addEventListener('click', alternarResaltado);
    galeria.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.btn-ver-fotos');
      if (boton) abrirVisor(boton.dataset.propiedad);
    });
    iniciarVisor();
    cargarGaleria();
  }

  // Vista inicial como visitante y, en paralelo, consulta al endpoint privado
  // para saber si hay una sesión abierta en el servidor
  aplicarVista();
  comprobarSesion();
});
