/* =========================================================
   AA25 — Páginas de ingreso (login.html) y registro (registro.html)
   ========================================================= */

const alerta       = document.querySelector('#alerta');
const formLogin    = document.querySelector('#form-login');
const formRegistro = document.querySelector('#form-registro');

const REGEX_USUARIO = /^[A-Za-z0-9_.-]{3,30}$/;

/* POST api/login.php */
async function manejarLogin(evento) {
  evento.preventDefault();
  const boton  = formLogin.querySelector('button[type="submit"]');
  const nombre = formLogin.elements.nombre.value.trim();
  const clave  = formLogin.elements.clave.value;

  if (!nombre || !clave) {
    mostrarMensaje(alerta, 'error', 'Ingresá tu usuario y tu contraseña.');
    return;
  }

  setCargando(boton, true, 'Verificando…');
  const { ok, datos } = await api('api/login.php', { metodo: 'POST', json: { nombre, clave } });
  setCargando(boton, false);

  if (ok) {
    mostrarMensaje(alerta, 'exito', `¡Bienvenido/a, ${datos.usuario.nombre}!`); // textContent: seguro
    setTimeout(() => { window.location.href = paginaDeVuelta(); }, 700);
  } else {
    mostrarMensaje(alerta, 'error', datos.mensaje || 'No se pudo iniciar sesión.');
    formLogin.elements.clave.value = '';
    formLogin.elements.clave.focus();
  }
}

/* POST api/registro.php */
async function manejarRegistro(evento) {
  evento.preventDefault();
  const boton  = formRegistro.querySelector('button[type="submit"]');
  const nombre = formRegistro.elements.nombre.value.trim();
  const clave  = formRegistro.elements.clave.value;
  const clave2 = formRegistro.elements.clave2.value;

  // Validación en el cliente (la definitiva la hace el servidor)
  if (!REGEX_USUARIO.test(nombre)) {
    mostrarMensaje(alerta, 'error', 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.');
    return;
  }
  if (clave.length < 8) {
    mostrarMensaje(alerta, 'error', 'La contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (clave !== clave2) {
    mostrarMensaje(alerta, 'error', 'Las contraseñas no coinciden.');
    return;
  }

  setCargando(boton, true, 'Creando cuenta…');
  const { ok, datos } = await api('api/registro.php', { metodo: 'POST', json: { nombre, clave } });
  setCargando(boton, false);

  if (ok) {
    mostrarMensaje(alerta, 'exito', datos.mensaje);
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  } else {
    mostrarMensaje(alerta, 'error', datos.mensaje || 'No se pudo crear la cuenta.');
  }
}

if (formLogin) formLogin.addEventListener('submit', manejarLogin);
if (formRegistro) formRegistro.addEventListener('submit', manejarRegistro);

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await cargarSesion();
  if (usuario) {
    // Si ya hay una sesión abierta no tiene sentido volver a ingresar
    mostrarMensaje(alerta, 'info', `Ya iniciaste sesión como ${usuario.nombre}.`);
  }
  if (new URLSearchParams(window.location.search).get('volver') === 'admin.php' && !usuario) {
    mostrarMensaje(alerta, 'info', 'Ingresá con la cuenta de administrador para entrar al panel.');
  }
});
