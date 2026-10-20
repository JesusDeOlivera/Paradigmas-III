# AA15 — Validación de cupón de descuento

**Objetivo:** consolidar la captura de datos de texto, la limpieza de cadenas, la lógica condicional y la manipulación visual del DOM mediante clases CSS.

**Escenario:** en la pantalla de compra del proyecto **RN Inmobiliaria**, el usuario puede ingresar un código de descuento antes de enviar la solicitud.

## Archivos

| Archivo | Contenido |
|---|---|
| `comprar.html` | Pantalla de compra de RN Inmobiliaria con la sección **Código de descuento** y el resumen del importe |
| `cupon.js` | Función `validarCupon()` y registro de eventos |
| `cupon.css` | Clases `.mensaje-exito` y `.mensaje-error`, más los estilos del cupón |
| `style.css`, `img/` | Estilos e imágenes del sitio |

Para probarlo alcanza con abrir `comprar.html` en el navegador: no necesita servidor.

## La función `validarCupon()`

```js
function validarCupon() {
  const inputCupon = document.getElementById('input-cupon');
  const mensaje = document.getElementById('mensaje-cupon');

  // 1) Capturar el texto ingresado
  const textoIngresado = inputCupon.value;

  // 2) Limpiar espacios iniciales/finales y pasar a mayúsculas
  const codigo = textoIngresado.trim().toUpperCase();

  // Se quitan las clases anteriores para que no queden mezcladas
  mensaje.classList.remove('mensaje-exito', 'mensaje-error');

  // 3) Evaluar con condicionales
  if (codigo === '') {
    mensaje.textContent = 'Por favor, ingrese un código';
    mensaje.classList.add('mensaje-error');
  } else if (codigo === 'UCP10') {
    mensaje.textContent = '¡Cupón aplicado! Tenés un 10% de descuento';
    mensaje.classList.add('mensaje-exito');
  } else {
    mensaje.textContent = 'Código inválido o vencido';
    mensaje.classList.add('mensaje-error');
  }
}
```

(En `cupon.js` la función además guarda si el cupón quedó aplicado y recalcula el total.)

### Paso a paso

1. **Captura:** `inputCupon.value` toma el texto del `<input type="text" id="input-cupon">`.
2. **Limpieza:**
   - `.trim()` elimina los espacios del principio y del final. Así `"   "` se toma como vacío y `" UCP10 "` como `"UCP10"`.
   - `.toUpperCase()` pasa todo a mayúsculas. Así `ucp10`, `Ucp10` o `UCP10` se reconocen igual y el usuario no tiene que acertar las mayúsculas.
3. **Condicionales:** la cadena `if / else if / else` evalúa los tres casos en orden:
   - Primero el vacío.
   - Después el código válido.
   - Por último, cualquier otro texto, que es inválido.
4. **Manipulación visual:**
   - `textContent` cambia el mensaje.
   - `classList.add()` aplica la clase CSS que le da el color (verde para éxito, rojo para error).
   - Antes se ejecuta `classList.remove()` con ambas clases. Si no, al pasar de un error a un éxito el elemento quedaría con las dos clases a la vez.

### Cómo se dispara

La función se conecta con `addEventListener`, sin `onclick` en el HTML:

- **Botón "Aplicar"** → `validarCupon()`.
- **Enter dentro del campo** → `validarCupon()`, con `preventDefault()` para que no se envíe el formulario de compra.
- **Si el usuario edita el código** después de aplicarlo, el descuento se anula hasta que lo vuelva a validar.

### Extra: descuento en el total

Debajo del cupón hay un resumen que suma las propiedades elegidas. Con el cupón `UCP10` válido aparece la fila **"Descuento (10%)"** y el total se recalcula. Por ejemplo, Villa Sarita + Itaembé Guazú: USD 107.000 → **USD 96.300**.

## Pruebas

| Entrada | Mensaje | Clase aplicada |
|---|---|---|
| *(vacío)* | Por favor, ingrese un código | `.mensaje-error` |
| `"   "` (solo espacios) | Por favor, ingrese un código | `.mensaje-error` |
| `PROMO50` | Código inválido o vencido | `.mensaje-error` |
| `"  ucp10  "` | ¡Cupón aplicado! Tenés un 10% de descuento | `.mensaje-exito` |
| `UcP10` + Enter | ¡Cupón aplicado! Tenés un 10% de descuento (sin enviar el formulario) | `.mensaje-exito` |
