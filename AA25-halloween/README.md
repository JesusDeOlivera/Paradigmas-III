# 🎃 AA25 — Noche de Disfraces

Aplicación web con **API REST en PHP + MySQL** para registrar y votar los disfraces de Halloween favoritos.

- **Frontend:** HTML, CSS y JavaScript Vanilla con `fetch`.
- **Backend:** PHP con PDO, consultas preparadas, contraseñas con BCRYPT y sesiones.

---

## Instalación en XAMPP

1. Abrir el **XAMPP Control Panel** y encender **Apache** y **MySQL**.
2. Copiar esta carpeta dentro de `C:\xampp\htdocs\` y renombrarla **`halloween`**.
3. Entrar a **phpMyAdmin** (`http://localhost/phpmyadmin`) → pestaña **Importar** → elegir `sql/halloween.sql` → **Continuar**.
   - El script crea la base `halloween`, las 3 tablas, los usuarios de prueba y 6 disfraces con foto.
4. Abrir **`http://localhost/halloween/`**.

> **Contraseña de MySQL:** si tu MySQL tiene contraseña (XAMPP viene sin), cambiá `$pass` en `includes/conexion.php`.

### Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Halloween2026!` | Administrador: accede al panel `admin.php` |
| `ana` | `calabaza123` | Usuario (ya votó Calabaza, Fantasma y Vampiro) |
| `bruno` | `calabaza123` | Usuario |
| `carla` | `calabaza123` | Usuario |

---

## Cómo se cumple cada consigna

| Consigna | Dónde |
|---|---|
| **1a** Base `halloween` con las tablas `disfraces`, `usuarios` y `votos` | `sql/halloween.sql`, con las columnas exactamente como en el enunciado |
| **2a** Página principal con los disfraces, descripción y votos, consumiendo una API REST | `index.html` + `js/index.js` → `GET api/disfraces.php` |
| **2b** Botón "Votar" en cada disfraz sin votos duplicados | `POST api/votos.php`. Doble control: consulta previa e índice `UNIQUE (id_usuario, id_disfraz)` |
| **2c** Página de registro con usuario y contraseña | `registro.html` → `POST api/registro.php`. La contraseña se guarda con `password_hash` (BCRYPT) |
| **2d** Solo los usuarios registrados pueden votar | `api/votos.php` responde **401** si no hay sesión; el frontend envía al login |
| **2e** Página de inicio de sesión | `login.html` → `POST api/login.php` (`password_verify` + `session_regenerate_id`) |
| **2f** Página de administración solo para el administrador, con CRUD de disfraces | `admin.php`: protegida en el servidor y con CRUD completo sobre `api/disfraces.php` |
| **3a** Estilos de Halloween | `css/estilos.css`: noche violeta, naranja calabaza, luna, murciélagos y tipografía Creepster |
| **3b** Los usuarios pueden subir la imagen de su disfraz con la descripción | Formulario "Subí tu disfraz" en `index.html` (usuarios logueados) y en el panel admin |

---

## API REST

Todas las respuestas son JSON con la forma `{ "estado": "exito" | "error", ... }` y usan el **código HTTP** que corresponde.

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| `GET` | `api/disfraces.php` | Lista de disfraces visibles, ordenada por votos. Incluye `votado: true/false` para el usuario logueado | Público |
| `GET` | `api/disfraces.php?id=5` | Un disfraz | Público |
| `GET` | `api/disfraces.php?todos=1` | Todos, incluidos los de la papelera | Admin |
| `POST` | `api/disfraces.php` | Crear disfraz (`multipart/form-data`: nombre, descripcion, foto) | Usuario logueado |
| `PUT` | `api/disfraces.php?id=5` | Modificar nombre, descripción, foto o restaurar (`eliminado: 0`) | Admin |
| `DELETE` | `api/disfraces.php?id=5` | Enviar a la papelera (borrado lógico) | Admin |
| `DELETE` | `api/disfraces.php?id=5&definitivo=1` | Borrar de la base (solo si ya está en la papelera) | Admin |
| `GET` | `api/foto.php?id=5` | Imagen del disfraz, leída del BLOB | Público |
| `GET` | `api/votos.php` | Ids de los disfraces que votó el usuario | Usuario logueado |
| `POST` | `api/votos.php` `{ "id_disfraz": 5 }` | Votar | Usuario logueado |
| `DELETE` | `api/votos.php?id_disfraz=5` | Quitar el voto | Usuario logueado |
| `POST` | `api/registro.php` `{ "nombre", "clave" }` | Crear cuenta e iniciar sesión | Público |
| `POST` | `api/login.php` `{ "nombre", "clave" }` | Iniciar sesión | Público |
| `POST` | `api/logout.php` | Cerrar sesión | — |
| `GET` | `api/sesion.php` | Quién está logueado (para armar el menú) | Público |

**Códigos usados:**

| Código | Significado |
|---|---|
| 200 | OK |
| 201 | Creado |
| 400 | Datos inválidos |
| 401 | Sin sesión |
| 403 | Sin permiso |
| 404 | No existe |
| 405 | Método no permitido |
| 409 | Duplicado (voto repetido o usuario ya registrado) |
| 413 | Imagen muy pesada |
| 415 | Formato de imagen no permitido |

> **PUT con imagen:** los archivos solo se pueden enviar con `POST`. Por eso, para modificar un disfraz con foto nueva, el frontend envía `POST` + la cabecera `X-HTTP-Method-Override: PUT`, y la API lo trata como un `PUT`.

---

## Seguridad

| Riesgo | Cómo se resuelve |
|---|---|
| **Inyección SQL** | Todas las consultas usan **PDO con consultas preparadas** (`prepare` + `bindValue`) y `ATTR_EMULATE_PREPARES = false` |
| **Contraseñas expuestas** | Se guardan con **`password_hash` (BCRYPT)** y se verifican con `password_verify`. El login responde igual si falla el usuario o la clave, y tarda lo mismo aunque el usuario no exista |
| **Acceso sin permiso** | **Sesiones PHP**: votar exige sesión (401) y el CRUD exige ser admin (403). `admin.php` se protege en el servidor, así que su HTML nunca llega a quien no es administrador |
| **Robo de sesión** | Cookie `HttpOnly` + `SameSite=Strict`, `session_regenerate_id(true)` al ingresar y `use_strict_mode` |
| **XSS** | Todo lo que escriben los usuarios se muestra con **`textContent`**, nunca con `innerHTML`. Se probó con un disfraz llamado `<img src=x onerror=alert(1)>`: se ve como texto |
| **CSRF** | Las peticiones que modifican datos deben traer la cabecera `X-Requested-With: fetch`, que un formulario de otro sitio no puede agregar. Además la cookie es `SameSite=Strict` |
| **Archivos maliciosos** | El tipo de imagen se detecta leyendo el **contenido** (`getimagesizefromstring`), no la extensión. Solo se aceptan JPG, PNG, GIF y WEBP (SVG rechazado). `foto.php` responde con `Content-Security-Policy: default-src 'none'` |
| **Archivos internos** | `includes/` y `sql/` tienen un `.htaccess` con `Require all denied` |
| **Errores** | El detalle técnico va al log del servidor (`error_log`); al usuario solo le llega un mensaje genérico |

---

## Decisiones de diseño

- **Quién es administrador:** la tabla `usuarios` del enunciado no tiene columna de rol, así que el administrador se define en `includes/sesion.php`:

  ```php
  const ADMINISTRADORES = ['admin'];
  ```

  Nadie puede registrarse con ese nombre.
- **Columna `foto` (varchar 20):** guarda el **tipo MIME** de la imagen (`image/jpeg`, `image/png`…). `foto.php` lo usa para servir el BLOB con la cabecera correcta.
- **Límite de 64 KB del BLOB:** una columna `BLOB` admite como máximo 65.535 bytes. Por eso, antes de subir, el navegador **achica y comprime la foto a JPEG por debajo de 60 KB** (`comprimirImagen()` en `js/comun.js`). Se probó con un PNG de 6 MB. El servidor igual rechaza cualquier archivo de más de 64 KB.
- **Votos:** cada usuario puede votar **una vez por cada disfraz**. Puede votar varios disfraces distintos y también **quitar su voto**.
  - La columna `disfraces.votos` y la tabla `votos` se actualizan en la misma **transacción**, así nunca quedan desfasadas.
- **Borrado lógico:** "Eliminar" usa la columna `eliminado` del enunciado. El disfraz deja de mostrarse pero conserva sus votos y se puede **restaurar**. Desde la papelera se puede borrar definitivamente.
- **Fotos de usuarios:** cualquier usuario registrado puede publicar su disfraz, con foto obligatoria. El administrador modera desde el panel.

---

## Estructura

```
halloween/
├── index.html          → ranking, votación y "Subí tu disfraz"
├── login.html          → inicio de sesión
├── registro.html       → registro de usuarios
├── admin.php           → panel de administración (protegido en el servidor)
├── api/
│   ├── disfraces.php   → CRUD de disfraces
│   ├── votos.php       → votar / quitar voto
│   ├── foto.php        → sirve la imagen guardada en el BLOB
│   ├── registro.php · login.php · logout.php · sesion.php
├── includes/           → conexión PDO, sesión y utilidades de la API (no accesible por URL)
├── js/
│   ├── comun.js        → cliente fetch, menú según la sesión, compresión de imágenes
│   ├── index.js · acceso.js · admin.js
├── css/estilos.css
└── sql/halloween.sql   → base de datos con datos de prueba
```

---

## Pruebas realizadas

**API** (con `curl`): listado, detalle y 404.

**Votos:**
- votar → 201;
- votar de nuevo → **409**;
- quitar el voto → 200;
- votar sin sesión → **401**;
- votar un disfraz eliminado → 404.

**Registro:** datos inválidos → 400; usuario repetido o `admin` → 409.

**Petición sin cabecera CSRF:** → 403.

**Un usuario común:**
- editar o borrar → **403**;
- subir un SVG → **415**;
- subir 70 KB → **413**.

**Admin:**
- crear con o sin foto;
- editar por JSON y por multipart con foto nueva;
- quitar la foto;
- enviar a la papelera, restaurar y borrar definitivamente (los votos se borran en cascada).

Al terminar, la columna `votos` coincide con la cantidad de filas de la tabla `votos` en todos los disfraces.

**Interfaz** (navegador automatizado):
- el visitante ve el ranking y, al tocar "Votar", va al login;
- `ana` vota y quita el voto;
- se publica un disfraz con una foto de 6 MB, que se comprime sola;
- `ana` entra a `admin.php` → **403**;
- el visitante entra a `admin.php` → va al login;
- `admin` hace el CRUD completo desde el panel;
- la versión para celular se ve sin desplazamiento horizontal;
- la consola no muestra errores.

> Las pruebas se hicieron con el servidor de PHP y una base SQLite con la misma estructura, porque en el entorno de desarrollo no había MySQL. En XAMPP se usa MySQL con `sql/halloween.sql`.
