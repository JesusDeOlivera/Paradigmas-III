document.addEventListener('DOMContentLoaded', () => {
    const formBuscar  = document.querySelector('#form-buscar');
    const inputBuscar = document.querySelector('#input-buscar');
    const contenedor  = document.querySelector('#resultados');
    const estado      = document.querySelector('#estado');

    const formAlta    = document.querySelector('#form-alta');
    const estadoAlta  = document.querySelector('#estado-alta');

    const ENDPOINTS = {
        seguro:     'api/buscador-seguro.php',
        vulnerable: 'api/buscador-vulnerable.php'
    };

    const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

    // ---------- LECTURA: buscador ----------
    async function buscar() {
        const query = inputBuscar.value.trim();
        const modo  = document.querySelector('input[name="modo"]:checked').value;

        contenedor.innerHTML = '';
        estado.className = 'estado';
        estado.textContent = 'Buscando en la base de datos...';

        try {
            // Petición GET; encodeURIComponent codifica el texto para la URL
            const res = await fetch(`${ENDPOINTS[modo]}?q=${encodeURIComponent(query)}`);
            const resultado = await res.json();

            if (res.ok && resultado.estado === 'exito') {
                estado.textContent = `${resultado.total} resultado(s) — endpoint ${modo}.`;
                renderizarProductos(resultado.data);
            } else {
                mostrarError(estado, resultado.mensaje || 'No se pudo realizar la búsqueda.');
            }
        } catch (error) {
            mostrarError(estado, 'Error de conexión con el servidor.');
        }
    }

    formBuscar.addEventListener('submit', (e) => {
        e.preventDefault(); // Previene la recarga del navegador
        buscar();
    });

    function renderizarProductos(productos) {
        contenedor.innerHTML = ''; // Limpiamos el contenedor

        if (productos.length === 0) {
            contenedor.textContent = 'Sin resultados.';
            return;
        }

        const fragmento = document.createDocumentFragment();
        productos.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'card-producto';

            // Renderizado seguro en el DOM con textContent (evita XSS)
            const titulo = document.createElement('h4');
            titulo.textContent = prod.nombre;

            const categoria = document.createElement('span');
            categoria.className = 'categoria';
            categoria.textContent = prod.categoria ?? '';

            const precio = document.createElement('p');
            precio.textContent = formatoPrecio.format(Number(prod.precio));

            const stock = document.createElement('small');
            stock.className = 'stock';
            stock.textContent = prod.stock !== undefined ? `Stock: ${prod.stock}` : '';

            card.append(titulo, categoria, precio, stock);
            fragmento.appendChild(card);
        });

        contenedor.appendChild(fragmento);
    }

    // ---------- ESCRITURA: alta de producto ----------
    formAlta.addEventListener('submit', async (e) => {
        e.preventDefault();

        const producto = {
            nombre:    document.querySelector('#alta-nombre').value.trim(),
            categoria: document.querySelector('#alta-categoria').value.trim(),
            precio:    document.querySelector('#alta-precio').value,
            stock:     document.querySelector('#alta-stock').value
        };

        // Validación básica en el cliente (la definitiva se hace en el servidor)
        if (!producto.nombre || !producto.categoria || !(Number(producto.precio) > 0)) {
            mostrarError(estadoAlta, 'Completá nombre, categoría y un precio mayor a 0.');
            return;
        }

        estadoAlta.className = 'estado';
        estadoAlta.textContent = 'Guardando...';

        try {
            const res = await fetch('api/agregar-producto.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(producto)
            });
            const resultado = await res.json();

            if (res.ok && resultado.estado === 'exito') {
                estadoAlta.className = 'estado ok';
                estadoAlta.textContent = resultado.mensaje;
                formAlta.reset();
                inputBuscar.value = producto.nombre;
                buscar(); // Muestra el producto recién creado
            } else {
                mostrarError(estadoAlta, resultado.mensaje || 'No se pudo guardar el producto.');
            }
        } catch (error) {
            mostrarError(estadoAlta, 'Error de conexión con el servidor.');
        }
    });

    function mostrarError(elemento, mensaje) {
        elemento.className = 'estado error';
        elemento.textContent = mensaje;
    }

    // Carga inicial del catálogo completo
    buscar();
});
