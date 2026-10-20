/* =========================================================
   AA15 — Validación de cupón de descuento
   RN Inmobiliaria · Pantalla de compra

   Captura de texto, limpieza de cadenas (trim + toUpperCase),
   lógica condicional if / else y manipulación visual del DOM
   mediante clases CSS (.mensaje-exito / .mensaje-error).
   ========================================================= */

const CUPON_VALIDO = 'UCP10';
const PORCENTAJE_DESCUENTO = 10;

let cuponAplicado = false; // se usa para calcular el total con descuento

/**
 * Valida el código ingresado en el campo de cupón y muestra
 * el resultado aplicando la clase CSS correspondiente.
 */
function validarCupon() {
  const inputCupon = document.getElementById('input-cupon');
  const mensaje = document.getElementById('mensaje-cupon');

  // 1) Capturar el texto ingresado
  const textoIngresado = inputCupon.value;

  // 2) Limpiar espacios iniciales/finales y pasar a mayúsculas
  //    "  ucp10 " → "UCP10"
  const codigo = textoIngresado.trim().toUpperCase();

  // Se quitan las clases anteriores para que no queden mezcladas
  mensaje.classList.remove('mensaje-exito', 'mensaje-error');

  // 3) Evaluar con condicionales
  if (codigo === '') {
    mensaje.textContent = 'Por favor, ingrese un código';
    mensaje.classList.add('mensaje-error');
    cuponAplicado = false;
  } else if (codigo === CUPON_VALIDO) {
    mensaje.textContent = '¡Cupón aplicado! Tenés un 10% de descuento';
    mensaje.classList.add('mensaje-exito');
    cuponAplicado = true;
  } else {
    mensaje.textContent = 'Código inválido o vencido';
    mensaje.classList.add('mensaje-error');
    cuponAplicado = false;
  }

  // Se muestra el código ya limpio en el campo
  inputCupon.value = codigo;

  actualizarTotal();
}

/* ---------------------------------------------------------
   Total de la compra (suma las propiedades elegidas y,
   si el cupón es válido, descuenta el 10%)
   --------------------------------------------------------- */
const formatoUSD = new Intl.NumberFormat('es-AR');

function actualizarTotal() {
  const seleccionadas = document.querySelectorAll('input[name="productos"]:checked');

  let subtotal = 0;
  seleccionadas.forEach((casilla) => {
    subtotal += Number(casilla.dataset.precio);
  });

  const descuento = cuponAplicado ? (subtotal * PORCENTAJE_DESCUENTO) / 100 : 0;
  const total = subtotal - descuento;

  document.getElementById('subtotal').textContent = `USD ${formatoUSD.format(subtotal)}`;
  document.getElementById('descuento').textContent = `- USD ${formatoUSD.format(descuento)}`;
  document.getElementById('total').textContent = `USD ${formatoUSD.format(total)}`;
  document.getElementById('fila-descuento').hidden = !cuponAplicado;
}

/* ---------------------------------------------------------
   Registro de eventos (sin onclick en el HTML)
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const inputCupon = document.getElementById('input-cupon');

  // Botón "Aplicar"
  document.getElementById('btn-cupon').addEventListener('click', validarCupon);

  // Enter dentro del campo aplica el cupón en lugar de enviar el formulario
  inputCupon.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      validarCupon();
    }
  });

  // Si el usuario cambia el código después de aplicarlo, el descuento deja de valer
  inputCupon.addEventListener('input', () => {
    if (cuponAplicado) {
      cuponAplicado = false;
      const mensaje = document.getElementById('mensaje-cupon');
      mensaje.textContent = '';
      mensaje.classList.remove('mensaje-exito', 'mensaje-error');
      actualizarTotal();
    }
  });

  // Recalcula el total al elegir o quitar propiedades
  document.querySelectorAll('input[name="productos"]').forEach((casilla) => {
    casilla.addEventListener('change', actualizarTotal);
  });

  actualizarTotal();
});
