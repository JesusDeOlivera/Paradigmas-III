/* =========================================================
   AA17 — Catálogo asíncrono de RN Inmobiliaria
   querySelector + addEventListener + JSON + fetch / async-await
   ========================================================= */

const URL_PRODUCTOS = 'data/productos.json';
const formatoPrecio = new Intl.NumberFormat('es-AR');

/* ---------------------------------------------------------
   1) Carga asíncrona: se dispara con el evento "load"
   --------------------------------------------------------- */
window.addEventListener('load', cargarProductos);

/* ---------------------------------------------------------
   2) fetch + async/await: trae el JSON en segundo plano
   --------------------------------------------------------- */
async function cargarProductos() {
  // Selección del DOM con querySelector (selectores CSS)
  const grilla = document.querySelector('.grilla-productos');
  const estado = document.querySelector('.estado');

  try {
    // await espera la respuesta sin congelar la página
    const respuesta = await fetch(URL_PRODUCTOS);

    // fetch solo falla por errores de red: un 404 hay que controlarlo a mano
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }

    // .json() convierte el texto JSON en un objeto de JavaScript
    const datos = await respuesta.json();
    const productos = datos.productos;

    if (productos.length === 0) {
      mostrarEstado(estado, 'vacio', 'Por el momento no hay propiedades publicadas.');
      return;
    }

    renderizarProductos(grilla, productos, datos.moneda);
    mostrarEstado(estado, 'listo', `${productos.length} propiedades disponibles`);

  } catch (error) {
    console.error('Error al cargar los productos:', error);
    mostrarEstado(estado, 'error',
      'No pudimos cargar las propiedades. Abrí la página con un servidor local (Live Server o XAMPP).');
  } finally {
    grilla.setAttribute('aria-busy', 'false');
  }
}

/* ---------------------------------------------------------
   3) Renderizado: una tarjeta por cada producto del JSON
   --------------------------------------------------------- */
function renderizarProductos(grilla, productos, moneda) {
  // El fragmento junta todas las tarjetas y se inserta una sola vez en el DOM
  const fragmento = document.createDocumentFragment();

  productos.forEach((producto) => {
    fragmento.appendChild(crearTarjeta(producto, moneda));
  });

  grilla.replaceChildren(fragmento);
}

function crearTarjeta(producto, moneda) {
  const tarjeta = crear('article', 'tarjeta');
  tarjeta.dataset.id = producto.id;
  if (producto.destacada) tarjeta.classList.add('tarjeta--destacada');

  // Imagen
  const figura = crear('figure', 'tarjeta-imagen');
  const img = document.createElement('img');
  img.src = producto.imagen;
  img.alt = `${producto.titulo} en ${producto.barrio}`;
  img.loading = 'lazy';
  figura.appendChild(img);
  figura.appendChild(crear('span', 'tarjeta-tipo', producto.tipo));
  if (producto.destacada) {
    figura.appendChild(crear('span', 'tarjeta-cinta', '★ Destacada'));
  }

  // Cuerpo
  const cuerpo = crear('div', 'tarjeta-cuerpo');
  cuerpo.appendChild(crear('p', 'tarjeta-precio', `${moneda} ${formatoPrecio.format(producto.precio)}`));
  cuerpo.appendChild(crear('h2', 'tarjeta-titulo', producto.titulo));
  cuerpo.appendChild(crear('p', 'tarjeta-ubicacion', producto.barrio));
  cuerpo.appendChild(crear('p', 'tarjeta-descripcion', producto.descripcion));

  // Datos técnicos
  const datos = crear('ul', 'tarjeta-datos');
  datos.appendChild(crear('li', '', `${producto.superficie} m²`));
  if (producto.ambientes) {
    datos.appendChild(crear('li', '', `${producto.ambientes} ambientes`));
  }
  cuerpo.appendChild(datos);

  // Características (array dentro del objeto JSON)
  const etiquetas = crear('ul', 'tarjeta-etiquetas');
  producto.caracteristicas.forEach((caracteristica) => {
    etiquetas.appendChild(crear('li', '', caracteristica));
  });
  cuerpo.appendChild(etiquetas);

  tarjeta.append(figura, cuerpo);
  return tarjeta;
}

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */

// Crea un elemento y le asigna el texto con textContent
// (solo texto: no interpreta HTML, por lo que es seguro frente a XSS)
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function mostrarEstado(elemento, tipo, mensaje) {
  elemento.dataset.estado = tipo;
  elemento.textContent = mensaje;
}
