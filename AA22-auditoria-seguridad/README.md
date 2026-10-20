# AA22 — Auditoría de seguridad: Sistema de Gestión Académica

**Caso:** la primera versión de la API (`login.php` y `perfil.php`) presenta cuatro hallazgos de QA antes de salir a producción: inyección SQL en el login, contraseñas en texto plano, reenvío de credenciales en cada petición y XSS almacenado en el perfil.

---

## 1. Diagnóstico e impacto de riesgos

### Riesgo 1 — Inyección SQL en la autenticación (hallazgo 1)

```php
$sql = "SELECT * FROM usuarios WHERE email = '$email' AND password = '$pass'";
```

**Qué pasa:** los datos del formulario se **concatenan** dentro del SQL, así que el motor no puede distinguir qué parte es código y qué parte es dato. Una comilla simple escrita por el usuario cierra el string y lo que sigue se ejecuta como SQL.

**Ejemplo de ataque:** en el campo email se escribe `admin@ucp.edu.ar' -- ` (o `' OR 1=1 #`). La consulta queda:

```sql
SELECT * FROM usuarios WHERE email = 'admin@ucp.edu.ar' -- ' AND password = '...'
```

Todo lo que sigue a `--` es un comentario: **la condición de la contraseña desaparece**.

**Impacto (crítico):**
- **Bypass de autenticación:** se ingresa como cualquier usuario, incluido un administrativo, sin conocer su contraseña.
- **Exfiltración de datos:** con `UNION SELECT` se pueden leer otras tablas (notas, legajos, datos personales).
- **Alteración o destrucción de datos**, según los permisos del usuario de la base.

Afecta la **confidencialidad**, la **integridad** y la **disponibilidad** del sistema.

### Riesgo 2 — Contraseñas almacenadas en texto plano (hallazgo 2)

**Qué pasa:** la columna `password` guarda la contraseña tal cual la escribió el usuario. Quien acceda a la tabla, por la inyección del riesgo 1, un backup filtrado o un empleado con acceso a phpMyAdmin, **ve todas las contraseñas directamente**.

**Impacto (crítico):**
- **Robo masivo de cuentas** en un solo paso, sin necesidad de descifrar nada.
- **Credential stuffing:** la mayoría de las personas reutiliza contraseñas, así que el atacante prueba las mismas credenciales en el correo, el home banking o las redes sociales de alumnos y docentes. El daño **sale del sistema**.
- **Incumplimiento legal:** la Ley 25.326 de Protección de Datos Personales obliga a adoptar medidas técnicas de seguridad sobre los datos.
- Además **viola el principio de no repudio**: si el personal puede ver las claves, no se puede demostrar quién hizo realmente una acción.

### Riesgo 3 — Backend sin estado: credenciales reenviadas en cada petición (hallazgo 3)

**Qué pasa:** HTTP es un protocolo **sin estado**, y el backend no implementa ningún mecanismo para recordar al usuario autenticado. La solución adoptada fue que el frontend **guarde el email y la contraseña** y los mande en una cabecera en cada clic.

**Impacto (alto), riesgo de arquitectura y de seguridad:**
- **Mayor superficie de exposición:** la credencial real viaja cientos de veces por sesión. Cada petición es una oportunidad de interceptarla (sin HTTPS, en logs del servidor o proxies, en herramientas de depuración).
- **Almacenamiento inseguro en el cliente:** para reenviarla, el frontend tiene que guardar la contraseña en memoria, `localStorage` o una cookie legible por JavaScript. Combinado con el riesgo 4, **un XSS roba directamente la contraseña**, no solo una sesión.
- **Sin control del ciclo de vida:** no hay forma de cerrar sesión de verdad, de vencer por inactividad ni de revocar el acceso. La credencial no expira nunca.
- **Rendimiento:** en cada petición se vuelve a consultar la base y a verificar la contraseña. Con BCRYPT, que es lento a propósito, eso multiplica la carga del servidor.
- **Multiplica el riesgo 1:** cada endpoint vuelve a ejecutar la consulta vulnerable.

### Riesgo 4 — Cross-Site Scripting (XSS) almacenado en el perfil (hallazgo 4)

```php
echo $usuario['nombre'];
```

**Qué pasa:** un dato que controla el usuario (su nombre) se imprime en el HTML **sin escapar**. El navegador no puede diferenciar el texto del código, así que `<script>alert(document.cookie)</script>` se **ejecuta como JavaScript**. Es XSS **almacenado** (persistente): el script queda guardado en la base y se ejecuta en el navegador de **cada persona que vea ese perfil**, incluidos los administrativos.

**Impacto (alto/crítico):** el `alert()` es solo la prueba de concepto. Con el mismo hueco, un atacante puede:
- **Robar la cookie de sesión** de un administrativo (`document.cookie`) y suplantarlo (**session hijacking**).
- **Ejecutar acciones en su nombre**: cambiar notas, crear usuarios, modificar permisos.
- Mostrar formularios falsos para **capturar contraseñas** (phishing dentro del propio sitio).

Al apuntar a cuentas con privilegios, este riesgo lleva a una **escalada de privilegios**.

### Resumen

| # | Riesgo | Tipo | Severidad | Componente |
|---|---|---|---|---|
| 1 | Inyección SQL | Seguridad (OWASP A03 — Injection) | Crítica | `login.php` |
| 2 | Contraseñas en texto plano | Seguridad (OWASP A02 — Cryptographic Failures) | Crítica | Base de datos |
| 3 | Sin manejo de sesión / credenciales reenviadas | Arquitectura + Seguridad (OWASP A07 — Identification and Authentication Failures) | Alta | Backend y frontend |
| 4 | XSS almacenado | Seguridad (OWASP A03 — Injection) | Alta | `perfil.php` |

Los riesgos **se encadenan**: la inyección (1) expone las contraseñas en claro (2), y el XSS (4) puede robar la credencial que el frontend guarda por falta de sesión (3).

---

## 2. Fundamentación técnica de la remediación

Cada herramienta ataca la **causa raíz** de un hallazgo. Juntas cubren las tres capas del sistema: **base de datos, servidor y navegador**.

### PDO Prepared Statements → resuelve el riesgo 1

```php
$stmt = $pdo->prepare('SELECT ... FROM usuarios WHERE email = :email');
$stmt->bindValue(':email', $email, PDO::PARAM_STR);
$stmt->execute();
```

La inyección existe porque **datos y código viajan juntos**. La consulta preparada los **separa en dos envíos**:

1. **`prepare()`** manda a MySQL la estructura con marcadores (`:email`). El motor la analiza y la compila; desde ese momento la consulta **no puede cambiar de forma**.
2. **`execute()`** manda el valor por separado. MySQL lo trata **siempre como un dato**: `' OR 1=1 #` se busca como un email literal, que no existe.

Con `PDO::ATTR_EMULATE_PREPARES => false` la preparación la hace MySQL de forma nativa y no una emulación de PHP.

Además, la contraseña **sale del `WHERE`**: se busca solo por email y la clave se verifica en PHP contra el hash. Esto es obligatorio con BCRYPT, porque cada hash tiene su propia sal y no se puede comparar en SQL.

### BCRYPT (`password_hash` / `password_verify`) → resuelve el riesgo 2

```php
// Al registrar
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
// Al iniciar sesión
password_verify($passwordIngresada, $hashGuardado); // true / false
```

Se reemplaza la contraseña por su **hash**: una transformación de **una sola vía**. No se puede volver del hash a la contraseña. BCRYPT es adecuado (y MD5 o SHA-1 no) por tres propiedades:

- **Sal aleatoria por usuario:** dos personas con la misma clave obtienen hashes distintos. Eso inutiliza las **rainbow tables** (tablas precalculadas) y obliga a atacar cada cuenta por separado.
- **Lento a propósito, con costo ajustable:** con `cost = 12` cada verificación tarda del orden de cientos de milisegundos. Para un login legítimo es imperceptible, pero para un ataque de fuerza bruta significa pocos intentos por segundo en lugar de miles de millones.
- **Hash autocontenido:** el string `$2y$12$...` incluye algoritmo, costo y sal. `password_verify()` lee todo de ahí y compara en **tiempo constante**, lo que evita ataques de temporización.

Con `password_needs_rehash()` se sube el costo de los hashes viejos cuando el usuario inicia sesión, sin forzar a nadie a cambiar la clave. **Resultado:** aunque la tabla se filtre, el atacante no obtiene las contraseñas.

### `session_start()` → resuelve el riesgo 3

```php
session_start();
session_regenerate_id(true);
$_SESSION['usuario_id'] = $usuario['id'];
```

Las sesiones de PHP agregan el **estado** que HTTP no tiene:

1. El usuario se autentica **una sola vez**. El servidor guarda sus datos en `$_SESSION`, del lado del servidor, y le entrega al navegador solo un **identificador aleatorio** en una cookie.
2. En las peticiones siguientes, el navegador envía **solo esa cookie**. El backend recupera la identidad con `$_SESSION['usuario_id']`. **La contraseña no vuelve a viajar** ni a guardarse en el cliente.

Configurada de forma segura, la sesión también agrega **control del ciclo de vida**:

- **`session_regenerate_id(true)`** al iniciar sesión cambia el ID y evita la **fijación de sesión**.
- **Cookie `HttpOnly`**: JavaScript **no puede leerla**, así que `document.cookie` ya no la expone aunque haya un XSS.
- **Cookie `Secure`**: solo viaja por HTTPS.
- **Cookie `SameSite=Strict`**: no se envía desde otros sitios, lo que mitiga CSRF.
- **`use_strict_mode`**: se rechazan IDs de sesión que no generó el servidor.
- **Vencimiento por inactividad** y **logout real** con `session_destroy()`: el acceso puede revocarse.

Si se roba una cookie de sesión, el daño es acotado: expira y se puede invalidar. Una contraseña robada, en cambio, sirve para siempre y en otros sitios.

### `htmlspecialchars()` → resuelve el riesgo 4

```php
echo htmlspecialchars($usuario['nombre'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
```

El XSS existe porque el navegador interpreta el dato como **marcado HTML**. `htmlspecialchars()` **codifica en la salida** los caracteres especiales:

| Carácter | Se convierte en |
|---|---|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#039;` |
| `&` | `&amp;` |

El navegador **muestra** `<script>alert(document.cookie)</script>` como texto y **no lo ejecuta**.

Detalles importantes:
- **`ENT_QUOTES`** escapa también las comillas simples, que es necesario si el dato se imprime dentro de un atributo HTML.
- El **charset `UTF-8`** debe coincidir con el de la página.
- **Se escapa al imprimir, no al guardar.** La base conserva el dato original y se escapa según el contexto de salida.

Como defensa en profundidad se agrega una cabecera **Content-Security-Policy** que bloquea scripts en línea.

### Por qué la combinación es integral

| Capa | Vulnerabilidad | Control | Qué garantiza |
|---|---|---|---|
| Base de datos (consulta) | Inyección SQL | PDO Prepared Statements | El usuario no puede cambiar la consulta |
| Base de datos (almacenamiento) | Texto plano | BCRYPT | Una filtración no expone contraseñas |
| Servidor (estado) | Credenciales reenviadas | `session_start()` segura | La clave viaja una sola vez; el acceso vence y se revoca |
| Navegador (salida) | XSS | `htmlspecialchars()` | El dato se muestra, nunca se ejecuta |

Cada control cubre una capa distinta y **ninguno reemplaza a otro**:
- PDO no evita el XSS: un nombre malicioso se guarda perfectamente con una consulta preparada.
- `htmlspecialchars()` no evita la inyección SQL: actúa en la salida HTML, no en la consulta.

Además los controles **se refuerzan entre sí** y cortan la cadena de ataque del diagnóstico. Sin inyección no hay acceso a la tabla. Si igual se filtrara, solo habría hashes. El XSS queda neutralizado y, aunque apareciera otro, la cookie `HttpOnly` no puede leerse y la contraseña ya no está en el cliente.

> **Complementos recomendados para producción:** HTTPS obligatorio, límite de intentos de login por IP (contra fuerza bruta), un usuario de MySQL con permisos mínimos para la aplicación, token CSRF en formularios que modifican datos y validación del nombre en el registro (longitud y caracteres permitidos).

---

## 3. Propuesta de código seguro — `api/login.php`

El archivo completo está en [`api/login.php`](api/login.php). La configuración segura de la sesión está en [`config/sesion.php`](config/sesion.php).

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/sesion.php';   // session_start() con cookie segura
require_once __DIR__ . '/../config/conexion.php'; // $pdo (EMULATE_PREPARES = false)

header('Content-Type: application/json; charset=utf-8');

function responder(int $codigo, array $cuerpo): void
{
    http_response_code($codigo);
    echo json_encode($cuerpo, JSON_UNESCAPED_UNICODE);
    exit;
}

// 1) Solo POST: las credenciales nunca viajan en la URL
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder(405, ['estado' => 'error', 'mensaje' => 'Método no permitido.']);
}

// 2) Lectura y validación de la entrada
$datos    = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$email    = is_string($datos['email']    ?? null) ? trim($datos['email']) : '';
$password = is_string($datos['password'] ?? null) ? $datos['password']   : '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 72) {
    responder(400, ['estado' => 'error', 'mensaje' => 'Email o contraseña con formato inválido.']);
}

try {
    // 3) Consulta preparada: se busca SOLO por email
    $stmt = $pdo->prepare(
        'SELECT id, nombre, email, password_hash, rol
           FROM usuarios
          WHERE email = :email
          LIMIT 1'
    );
    $stmt->bindValue(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $usuario = $stmt->fetch();

    // 4) Verificación BCRYPT (con hash ficticio si el email no existe,
    //    para que el tiempo de respuesta no revele qué emails están registrados)
    $hashFicticio = '$2y$12$xCydsmoTmaA30w3vZLYFrud/UKTmsEsn3vtgnnoNJVWOM26Xx1vaG';
    $hash         = $usuario['password_hash'] ?? $hashFicticio;
    $valida       = password_verify($password, $hash);

    if (!$usuario || !$valida) {
        responder(401, ['estado' => 'error', 'mensaje' => 'Credenciales incorrectas.']);
    }

    // 5) Actualiza el hash si fue generado con un costo menor
    if (password_needs_rehash($usuario['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
        $nuevo = $pdo->prepare('UPDATE usuarios SET password_hash = :hash WHERE id = :id');
        $nuevo->bindValue(':hash', password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), PDO::PARAM_STR);
        $nuevo->bindValue(':id',   (int) $usuario['id'], PDO::PARAM_INT);
        $nuevo->execute();
    }

    // 6) Sesión segura: nuevo ID y datos mínimos (nunca la contraseña ni el hash)
    session_regenerate_id(true);
    $_SESSION['usuario_id']       = (int) $usuario['id'];
    $_SESSION['rol']              = $usuario['rol'];
    $_SESSION['ultima_actividad'] = time();

    responder(200, [
        'estado'  => 'exito',
        'mensaje' => 'Sesión iniciada.',
        'usuario' => ['id' => (int) $usuario['id'], 'nombre' => $usuario['nombre'], 'rol' => $usuario['rol']],
    ]);

} catch (PDOException $e) {
    error_log('Error en login: ' . $e->getMessage()); // el detalle no se expone al cliente
    responder(500, ['estado' => 'error', 'mensaje' => 'No se pudo iniciar sesión.']);
}
```

### Configuración de la sesión — `config/sesion.php` (fragmento)

```php
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

session_name('SGA_SESSID');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $esHttps,  // true en producción con HTTPS
    'httponly' => true,      // inaccesible desde JavaScript
    'samesite' => 'Strict',  // no se envía desde otros sitios
]);
session_start();
```

### Archivos complementarios

- [`api/perfil.php`](api/perfil.php): identifica al usuario por `$_SESSION` y escapa todos los datos con `htmlspecialchars()` (corrige el hallazgo 4).
- [`api/logout.php`](api/logout.php): destruye la sesión y la cookie.
- [`sql/usuarios.sql`](sql/usuarios.sql): tabla con columna `password_hash` y usuarios de prueba (contraseña `Clave2026!`), incluido el usuario con el nombre malicioso del caso.

### Verificación realizada

| Prueba | Resultado |
|---|---|
| Acceder a `perfil.php` sin sesión | `401 Sesión no iniciada o vencida` |
| Login con `' OR 1=1 #` en el email | Rechazado: no hay bypass |
| Login con contraseña incorrecta | `401 Credenciales incorrectas` (mensaje genérico) |
| Login correcto | `200` + cookie `SGA_SESSID` con `HttpOnly; SameSite=Strict` |
| Perfil del usuario `<script>alert(document.cookie)</script>` | Se muestra como texto: `&lt;script&gt;...` (no se ejecuta) |
| Perfil después de `logout.php` | `401` (la sesión fue destruida) |
