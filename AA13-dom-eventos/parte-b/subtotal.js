/* =========================================================
   AA13 · Parte B — Subtotal en tiempo real (pantalla Comprar del TP1)
   Se captura el cambio de la cantidad de cada producto y se
   actualiza el subtotal y el total sin recargar la página.
   ========================================================= */

const filas = document.querySelectorAll('.producto-fila');
const totalCompra = document.querySelector('#total-compra');

const CANTIDAD_MAXIMA = 10;

// Formato de moneda: 1650 → "$1,650.00" (igual que los precios del maquetado)
const formatoPrecio = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/* Lee la cantidad de un input y la deja dentro del rango permitido */
function leerCantidad(input) {
  const cantidad = parseInt(input.value, 10);       // .value es texto → se convierte a entero
  if (Number.isNaN(cantidad) || cantidad < 0) return 0;
  return Math.min(cantidad, CANTIDAD_MAXIMA);
}

/* Recalcula el subtotal de cada producto y el total general */
function actualizarTotales() {
  let total = 0;

  filas.forEach((fila) => {
    const precio = Number(fila.dataset.precio);
    const inputCantidad = fila.querySelector('.input-cantidad');
    const checkbox = fila.querySelector('input[type="checkbox"]');
    const spanSubtotal = fila.querySelector('.subtotal-linea');

    const cantidad = leerCantidad(inputCantidad);
    const subtotal = precio * cantidad;   // cálculo en memoria
    total += subtotal;

    // Mutación del DOM: subtotal de la línea
    spanSubtotal.textContent = formatoPrecio.format(subtotal);

    // El producto queda marcado solo si se pide al menos una unidad
    checkbox.checked = cantidad > 0;
    fila.classList.toggle('producto-fila--activa', cantidad > 0);
  });

  // Mutación del DOM: total a abonar
  totalCompra.textContent = formatoPrecio.format(total);
}

/* Registro de eventos para cada producto */
filas.forEach((fila) => {
  const inputCantidad = fila.querySelector('.input-cantidad');
  const checkbox = fila.querySelector('input[type="checkbox"]');

  // Evento "input": se dispara con cada tecla o con las flechitas del campo,
  // así el subtotal cambia en tiempo real sin refrescar la página
  inputCantidad.addEventListener('input', actualizarTotales);

  // Al salir del campo se corrige un valor inválido (vacío, negativo o mayor al máximo)
  inputCantidad.addEventListener('change', () => {
    inputCantidad.value = leerCantidad(inputCantidad);
    actualizarTotales();
  });

  // Si se marca el producto sin cantidad, se pone 1; si se desmarca, se pone 0
  checkbox.addEventListener('change', () => {
    if (checkbox.checked && leerCantidad(inputCantidad) === 0) {
      inputCantidad.value = 1;
    } else if (!checkbox.checked) {
      inputCantidad.value = 0;
    }
    actualizarTotales();
  });
});

// Estado inicial
actualizarTotales();
