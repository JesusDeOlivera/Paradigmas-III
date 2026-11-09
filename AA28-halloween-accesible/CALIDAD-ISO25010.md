# Ficha de Autoevaluación de Calidad — ISO/IEC 25010

**Proyecto:** Noche de Disfraces (Desafío de Halloween)
**Actividad:** AA28 — La web del terror accesible
**Alumno:** De Olivera, Jesús

Cada característica se evaluó revisando el código y ejecutando las pruebas de `tests/test_api.php` (30 pruebas automáticas) y la prueba manual de teclado.

| Característica ISO 25010 | Pregunta | Evidencia técnica en el código | Estado |
|---|---|---|---|
| **1. Adecuación funcional** | ¿El backend en PHP procesa y persiste datos en MySQL vía PDO? | `includes/conexion.php` abre la conexión con PDO a la base `halloween`. Los endpoints de `api/` hacen alta, baja, modificación y consulta de disfraces, usuarios y votos. Los votos se guardan en la tabla `votos` y en el contador `disfraces.votos` dentro de una transacción. Pruebas 1 y 3 de `test_api.php`. | ✅ Cumple |
| **2. Eficiencia de desempeño** | ¿La API REST responde solicitudes JSON sin latencias desmedidas? | El listado no envía las imágenes: solo devuelve una URL, y las fotos se piden aparte a `api/foto.php` con caché de 24 h. Las fotos se comprimen en el navegador a menos de 60 KB antes de subirlas. `test_api.php` mide 20 pedidos al listado y exige un p95 menor a 500 ms. | ✅ Cumple |
| **3. Compatibilidad** | ¿La arquitectura está desacoplada (Frontend JS Vanilla / Backend PHP)? | El frontend (`*.html`, `js/`, `css/`) no tiene PHP mezclado: se comunica con el backend solo por `fetch()` y JSON. La API puede consumirla cualquier cliente; de hecho `test_api.php` la usa sin pasar por el navegador. Sin librerías externas, funciona en Chrome, Firefox y Edge. | ✅ Cumple |
| **4. Fiabilidad** | ¿Se capturan excepciones PDO y se devuelven códigos HTTP semánticos (200, 400, 500)? | Cada endpoint envuelve las consultas en `try / catch (PDOException)`. El detalle va a `error_log` y el cliente recibe un 500 genérico. Se usan 200, 201, 400, 401, 403, 404, 405, 409, 413, 415 y 500 según el caso. Los votos usan `beginTransaction` / `commit` / `rollBack`. El frontend muestra un mensaje si el servidor no responde. | ✅ Cumple |
| **5. Seguridad (OWASP)** | ¿Las contraseñas usan BCRYPT y los Prepared Statements previenen SQLi? | `password_hash(..., PASSWORD_BCRYPT)` al registrar y `password_verify` al ingresar. Todas las consultas usan `prepare` + `bindValue` con `ATTR_EMULATE_PREPARES = false`. Además: cookie de sesión `HttpOnly` + `SameSite=Strict`, `session_regenerate_id(true)`, cabecera anti-CSRF, validación del contenido de las imágenes (se rechaza SVG) y `textContent` contra XSS. *Mejora pendiente:* no hay límite de intentos de login, y en XAMPP el sitio corre sin HTTPS. | ✅ Cumple |
| **6. Usabilidad / Accesibilidad** | ¿Lighthouse marca 100/100 y la interfaz es 100% operable por teclado? | Lighthouse 100/100 en la página de inicio y en el panel de administración. Todo el sitio se recorre con Tab, Enter y Espacio. El foco es visible con `:focus-visible` y vuelve al mismo botón después de votar, editar o eliminar. Hay enlace "Saltar al contenido", las regiones `aria-live="polite"` anuncian los resultados de cada `fetch()` y los campos con error se marcan con `aria-invalid`. Se adapta al celular sin scroll horizontal, incluso a 320 px de ancho. | ✅ Cumple |
| **7. Mantenibilidad** | ¿El código está estructurado en capas limpias y versionado en Git? | Hay capas separadas: `includes/` (conexión, sesión y utilidades comunes), `api/` (un archivo por recurso), `js/` (`comun.js` + un archivo por página), `css/`, `sql/` y `tests/`. El proyecto está versionado en GitHub (repo Paradigmas-III). *Mejora pendiente:* la cabecera HTML se repite en las 4 páginas; podría generarse desde un solo lugar. | ✅ Cumple |

## Característica que exigió más trabajo de refactorización

**Usabilidad / Accesibilidad.** Lighthouse ya marcaba 100/100 en la versión anterior, pero la prueba con teclado mostró un problema que la herramienta no detecta. Cada vez que se votaba o se eliminaba un disfraz, la lista se volvía a dibujar desde la API y el botón que tenía el foco desaparecía. El foco volvía al principio de la página, y una persona que usa solo el teclado tenía que recorrer todo otra vez para seguir.

Para resolverlo hubo que pensar, después de cada operación asíncrona, a qué elemento devolver el foco:
- al botón del mismo disfraz después de votar;
- al botón "Restaurar" después de eliminar;
- al botón "Editar" después de guardar o restaurar.

## Mejoras pendientes detectadas

- **Seguridad:** limitar los intentos de inicio de sesión por IP (fuerza bruta) y usar HTTPS en producción.
- **Mantenibilidad:** generar la cabecera y el pie desde un único archivo para no repetirlos en cada página.
- **Testing:** agregar pruebas automáticas del frontend. Hoy la prueba de teclado se documenta a mano.
