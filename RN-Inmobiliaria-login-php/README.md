# RN Inmobiliaria — Autenticación segura con PHP, BCRYPT y sesiones

Evolución del proyecto del equipo **RN Inmobiliaria** (Calamari Santino · De Olivera Jesús), basado en el repositorio [RNinmobiliriaUPGRADE](https://github.com/Barriletecosmicok/RNinmobiliriaUPGRADE).

**Objetivo:** incorporar autenticación segura con **BCRYPT**, gestión de estado con **`session_start()`** y protección de endpoints privados contra accesos no autorizados (**401 Unauthorized**) y **XSS**.

### Qué cambió respecto de la versión anterior

| Antes (Opción 4, solo frontend) | Ahora (backend PHP + MySQL) |
|---|---|
| Usuarios en `data/usuarios.json` con **contraseñas en texto plano** | Tabla `usuarios` en MySQL con **hash BCRYPT** (`data/usuarios.json` fue eliminado) |
| Login comparando claves **en el navegador** | `password_verify()` **en el servidor** |
| Sesión guardada en `sessionStorage` (la podía editar cualquiera desde la consola) | `$_SESSION` en el servidor + cookie **HttpOnly** |
| Registro guardado en `localStorage` del navegador | `INSERT` con **PDO Prepared Statements** |
| Favoritos en `localStorage`, por navegador | Tabla `favoritos` + endpoint privado **`api/mis_favoritos.php`** (401 sin sesión) |

---

## Estructura

```
RN-Inmobiliaria-login-php/
├── sql/rn_inmobiliaria.sql      ← Paso 1: base, tablas usuarios y favoritos, cuentas de prueba
├── config/
│   ├── conexion.php             ← PDO (EMULATE_PREPARES = false)
│   └── sesion.php               ← session_start() con cookie segura + guardián requerirSesion()
├── api/
│   ├── registro.php             ← Paso 2: JSON → password_hash(BCRYPT) → INSERT preparado
│   ├── login.php                ← Paso 2: password_verify + session_regenerate_id(true)
│   ├── logout.php               ← destruye la sesión y la cookie
│   ├── perfil.php               ← privado: 200 con sesión / 401 sin sesión
│   └── mis_favoritos.php        ← Paso 3: endpoint clave del dominio (401 sin sesión)
├── app.js                       ← Paso 4: SPA con fetch, alternancia del DOM y textContent
├── acceso.html                  ← Ingresar / Crear cuenta / panel con "Mis propiedades favoritas"
├── index.html, listado_box.html, listado_tabla.html, producto*.html, comprar.html
├── data/propiedades.json        ← catálogo de propiedades
└── style.css, img/, docs/
```

## Cómo ejecutarlo (XAMPP)

1. Encender **Apache** y **MySQL** en el panel de XAMPP.
2. **phpMyAdmin → pestaña SQL →** pegar y ejecutar `sql/rn_inmobiliaria.sql`. Se crea la base `rn_inmobiliaria`.
3. Copiar la carpeta `RN-Inmobiliaria-login-php` dentro de `C:\xampp\htdocs\`.
4. Si tu MySQL tiene contraseña, ajustar `$pass` en `config/conexion.php`. Por defecto XAMPP no usa contraseña.
5. Abrir `http://localhost/RN-Inmobiliaria-login-php/`.

> Tiene que abrirse desde `http://localhost/...`. Con Live Server o abriendo el archivo directo, PHP no se ejecuta.

**Cuentas de prueba:**

| E-mail | Contraseña | Rol |
|---|---|---|
| ana@rninmobiliaria.com | tierraroja26 | cliente |
| rodrigo@rninmobiliaria.com | posadas2026 | agente |

---

## Paso 1 — Capa de datos

```sql
CREATE TABLE IF NOT EXISTS usuarios (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,      -- hash BCRYPT
    rol        ENUM('cliente', 'agente') NOT NULL DEFAULT 'cliente',
    creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favoritos (
    usuario_id   INT         NOT NULL,
    propiedad_id VARCHAR(50) NOT NULL,
    creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, propiedad_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- **`password VARCHAR(255)`:** `password_hash()` genera hoy 60 caracteres. Se usa 255 porque PHP lo recomienda: si en el futuro el algoritmo por defecto cambia, el hash puede ser más largo.
- **`email UNIQUE`:** impide cuentas duplicadas. El registro responde **409 Conflict** en ese caso.
- **Clave primaria compuesta en `favoritos`:** un usuario no puede guardar dos veces la misma propiedad.
- **`ON DELETE CASCADE`:** si se borra el usuario, se borran sus favoritos.

---

## Paso 2 — Servicios de autenticación

### `api/registro.php`

1. Recibe un JSON (`php://input`) con `nombre`, `email` y `password`.
2. Valida en el servidor: nombre de 3 a 100 caracteres, e-mail válido y contraseña de 8 a 72 caracteres (72 bytes es el límite de BCRYPT). Si algo falla, responde **400**.
3. Hashea con `password_hash($password, PASSWORD_BCRYPT)`.
4. Inserta con consulta preparada (`prepare` + `bindValue`). El **rol lo fija el servidor** en `cliente`, así nadie puede registrarse como agente enviando `"rol": "agente"`.
5. Responde **201 Created** y deja la sesión iniciada, igual que el flujo original del sitio. Si el e-mail ya existe, responde **409 Conflict**.

> A diferencia del ejemplo de la cátedra, el nombre **no** se pasa por `htmlspecialchars()` antes de guardarlo. Se guarda el dato original y se escapa **al mostrarlo** (con `textContent`). Escapar al guardar ensucia la base (`&lt;` en lugar de `<`) y no protege otros contextos de salida.

### `api/login.php`

```php
$stmt = $pdo->prepare('SELECT id, nombre, email, password, rol FROM usuarios WHERE email = :email LIMIT 1');
$stmt->bindValue(':email', $email, PDO::PARAM_STR);
$stmt->execute();
$usuario = $stmt->fetch();

$passwordOk = password_verify($password, $usuario['password'] ?? $hashFicticio);

if (!$usuario || !$passwordOk) {
    responder(401, ['estado' => 'error', 'mensaje' => 'El e-mail o la contraseña no son correctos.']);
}

session_regenerate_id(true);
$_SESSION['usuario_id'] = (int) $usuario['id'];
```

- Se busca **solo por e-mail**. La contraseña se compara en PHP con `password_verify()`, que lee el algoritmo, el costo y la sal del propio hash.
- **`session_start()`** se ejecuta en `config/sesion.php` con una cookie segura:
  - **`HttpOnly`:** JavaScript no puede leerla.
  - **`SameSite=Lax`:** mitiga CSRF.
  - **`Secure`:** se activa con HTTPS.
  - **`use_strict_mode`:** rechaza IDs de sesión que no generó el servidor.
- **`session_regenerate_id(true)`** crea un ID nuevo al autenticarse y borra el anterior. Esto evita la **fijación de sesión**.
- Se guarda **solo el identificador** (`usuario_id`) y el rol, nunca la contraseña ni el hash.
- **Mismo mensaje** para e-mail inexistente y contraseña incorrecta. Si el e-mail no existe, se verifica igual contra un hash ficticio para que el tiempo de respuesta tampoco revele qué cuentas existen.

---

## Paso 3 — Endpoint privado del dominio: `api/mis_favoritos.php`

En una inmobiliaria, las propiedades que un cliente guarda son un **dato personal**: muestran qué está buscando, en qué zona y con qué presupuesto. Por eso es el servicio protegido.

```php
// ===== GUARDIÁN DE SESIÓN =====
if (!isset($_SESSION['usuario_id'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(['estado' => 'error', 'mensaje' => 'Acceso no autorizado. Iniciá sesión.']);
    exit;
}
$usuarioId = (int) $_SESSION['usuario_id'];
```

| Método | Acción | Respuesta |
|---|---|---|
| `GET` | Lista las favoritas del usuario, con título, barrio, precio y enlace a la ficha | 200 / **401** |
| `POST {"propiedad_id": "villa-sarita"}` | Agrega o quita la propiedad (toggle) | 200 / 400 / **401** |

- El usuario sale **siempre de `$_SESSION`**, nunca de un parámetro del cliente. Así nadie puede leer ni cambiar los favoritos de otra persona.
- Solo se aceptan `propiedad_id` que existan en `data/propiedades.json`. Cualquier otro valor responde **400**.
- Todas las consultas son preparadas.
- `api/perfil.php` usa el mismo guardián, mediante la función `requerirSesion()`.

---

## Paso 4 — Frontend SPA (`app.js`) y sanitización

### Verificación de la sesión al cargar

```js
// GET api/perfil.php → 200 = usuario autenticado / 401 = visitante
async function comprobarSesion() {
  const { ok, datos } = await llamarApi(API.perfil);
  sesionActual = ok ? datos.data : null;
  if (sesionActual) await cargarFavoritos();   // GET api/mis_favoritos.php
  aplicarVista();
}

document.addEventListener('DOMContentLoaded', () => {
  // ...
  aplicarVista();     // arranca como visitante
  comprobarSesion();  // pregunta al servidor si hay sesión
});
```

Cada página consulta al **servidor** si hay sesión. La "verdad" ya no está en `sessionStorage`, que cualquiera podía falsificar desde la consola.

### Alternancia dinámica del DOM (VSDM)

Los elementos marcados con `data-vista="visitante"` o `data-vista="usuario"` se muestran u ocultan según la respuesta del servidor:

| Visitante (401) | Usuario autenticado (200) |
|---|---|
| Enlace **Ingresar** en el menú | Saludo **"Hola, Nombre"** + botón **Salir** |
| Formularios de ingreso y registro | Panel de cuenta con rol y **Mis propiedades favoritas** |
| ♥ en las tarjetas → aviso "Ingresá a tu cuenta" | ♥ guarda o quita la favorita en MySQL |
| Formulario de compra vacío | Nombre y e-mail precargados |

Si una petición a `mis_favoritos.php` devuelve **401** (por ejemplo, porque la sesión venció), el frontend vuelve a la vista de visitante y avisa al usuario.

### Renderizado seguro (XSS)

Todo dato que viene del servidor se pinta con **`textContent`**, nunca con `innerHTML`:

```js
document.querySelectorAll('[data-usuario-nombre]').forEach((el) => {
  el.textContent = sesion.nombre.split(' ')[0];
});
```

`textContent` inserta el valor como **texto**: el navegador no lo interpreta como HTML, así que un `<script>` no se ejecuta. Lo mismo vale para el e-mail, el rol, los avisos y la lista de favoritas, que se construye con `createElement` + `textContent`.

---

## Pruebas realizadas

**API** (con `curl`):

| Prueba | Resultado |
|---|---|
| `perfil.php` / `mis_favoritos.php` (GET y POST) sin sesión | **401** |
| Login con la cuenta de prueba (hash del SQL) | 200 + cookie `RN_SESION; HttpOnly; SameSite=Lax` |
| Login con contraseña incorrecta | 401, mensaje genérico |
| `GET login.php` | 405 |
| Registro válido | 201, contraseña guardada como `$2y$10$...` |
| Registro con e-mail repetido | 409 |
| Registro con datos inválidos | 400 con los motivos |
| Favorito con `propiedad_id` inexistente (`x OR 1=1`) | 400 |
| Favoritos de un usuario nuevo | Lista vacía: no ve los de otros usuarios |
| `perfil.php` después de `logout.php` | **401** |

**Interfaz** (navegador automatizado):

- Al cargar sin sesión se ven los formularios. Después del login, el DOM cambia al panel de usuario.
- El ♥ guarda la favorita en el servidor y aparece en "Mis propiedades favoritas" y marcada en la página de inicio.
- Después de cerrar sesión y recargar, la página sigue en modo visitante.
- **XSS:** se registró un usuario con nombre `<script>alert(document.cookie)</script>`. El nombre se muestra como texto y **no se ejecutó ningún script** (captura en [`docs/prueba-xss-panel-usuario.png`](docs/prueba-xss-panel-usuario.png)).

![Panel de usuario con nombre malicioso mostrado como texto](docs/prueba-xss-panel-usuario.png)
