# AA21 — Buscador seguro con PDO y Consultas Preparadas

**Objetivo:** desarrollar un módulo backend seguro en PHP con **PDO** y **consultas preparadas** para leer y escribir datos, integrado con un frontend en **JavaScript Vanilla** (`fetch`).

---

## Estructura

```
AA21-buscador-seguro/
├── index.html                  → Buscador + formulario de alta
├── css/styles.css
├── js/app.js                   → fetch GET (búsqueda) y fetch POST (alta)
├── config/conexion.php         → Conexión PDO (prepared statements reales)
├── api/
│   ├── buscador-vulnerable.php → ❌ Versión original (concatenación) — se deja para el análisis
│   ├── buscador-seguro.php     → ✅ Lectura con PDO::prepare + bindValue
│   └── agregar-producto.php    → ✅ Escritura (INSERT) con PDO::prepare + bindValue
└── sql/productos.sql           → Base, tabla y datos de prueba
```

## Cómo ejecutarlo (XAMPP)

1. Abrir **phpMyAdmin** → pestaña **SQL** → pegar y ejecutar `sql/productos.sql` (crea la base `clase_backend`, la tabla y los 4 productos).
2. Copiar la carpeta `AA21-buscador-seguro` dentro de `C:\xampp\htdocs\`.
3. Revisar las credenciales en `config/conexion.php`. XAMPP trae `root` **sin contraseña**: en ese caso cambiar `$pass = 'root'` por `$pass = ''`.
4. Abrir `http://localhost/AA21-buscador-seguro/`.

En la interfaz hay un selector **"Endpoint a usar"** para alternar entre el buscador vulnerable y el seguro y comparar el comportamiento con las mismas entradas.

> **Corrección al archivo provisto:** en `config/conexion.php` original, la línea `$host = 'localhost';` quedó pegada al comentario anterior y por eso estaba comentada. Sin `$host` la conexión falla. Está corregido.

---

## Paso 3 — Análisis del buscador vulnerable

```php
$sql = "SELECT * FROM productos WHERE nombre LIKE '%" . $q . "%'";
$resultado = $pdo->query($sql);
```

El texto que escribe el usuario se **pega dentro del SQL**. Para MySQL, el dato y el código quedan mezclados en una sola cadena. Si el usuario escribe una comilla simple (`'`), **cierra el string** del `LIKE` y todo lo que escriba después se ejecuta como SQL.

Usar `PDO` no protege por sí solo: `$pdo->query()` con concatenación es tan inseguro como `mysqli_query()`. Lo que protege es **preparar** la consulta.

### Ataques de prueba (escribirlos en el buscador con el endpoint *vulnerable*)

| Entrada | SQL que se termina ejecutando | Resultado |
|---|---|---|
| `mouse` | `... LIKE '%mouse%'` | Búsqueda normal: 1 producto |
| `' OR '1'='1` | `... LIKE '%' OR '1'='1%'` | La condición queda siempre verdadera: **devuelve toda la tabla** |
| `zzz' UNION SELECT 1, user(), database(), 0, 0 #` | `... LIKE '%zzz' UNION SELECT 1, user(), database(), 0, 0 #%'` | **Filtra datos internos**: la tarjeta muestra el usuario de MySQL y el nombre de la base |
| `zzz' UNION SELECT 1, table_name, table_schema, 0, 0 FROM information_schema.tables #` | (igual, contra el catálogo del motor) | **Lista todas las tablas del servidor**: el primer paso para robar otras tablas (usuarios, claves, etc.) |
| `'` | `... LIKE '%'%'` | Error de sintaxis SQL: el servidor responde con un error y la página falla |

El `#` es un comentario en MySQL: anula el `%'` que agrega el código original. El `UNION` funciona porque la consulta original devuelve 5 columnas (`SELECT *`) y el ataque inyecta otras 5.

---

## Paso 4 — Solución: buscador con PDO statement

```php
$qLike = '%' . addcslashes($q, '%_\\') . '%';

$stmt = $pdo->prepare(
    'SELECT id, nombre, categoria, precio, stock
       FROM productos
      WHERE nombre LIKE :nombre OR categoria LIKE :categoria
   ORDER BY nombre ASC'
);
$stmt->bindValue(':nombre',    $qLike, PDO::PARAM_STR);
$stmt->bindValue(':categoria', $qLike, PDO::PARAM_STR);
$stmt->execute();
```

**Por qué ya no hay inyección:**

1. **`prepare()`** manda a MySQL la consulta con **marcadores** (`:nombre`, `:categoria`) y sin datos. MySQL la analiza y compila en ese momento: su estructura queda fija.
2. **`bindValue()` + `execute()`** mandan el valor por separado. MySQL lo usa **siempre como un dato**: una comilla es solo un carácter más a buscar, no puede cerrar el string ni sumar `OR`, `UNION` o comentarios.
3. **`PDO::ATTR_EMULATE_PREPARES => false`** obliga a que la preparación la haga MySQL de verdad y no una emulación de PHP.
4. Los `%` del `LIKE` se agregan **al valor**, no al SQL. Además se escapan los comodines `%` y `_` que escriba el usuario (`addcslashes`), para que buscar `%` no devuelva todo el catálogo.

**Medidas extra:**

- Solo se acepta `GET` (si no, **405**).
- Se valida que `q` sea texto (rechaza `?q[]=...`) y que no supere 100 caracteres (**400**).
- `SELECT` con columnas explícitas en lugar de `SELECT *`.
- Ante un error de base de datos se responde un mensaje genérico (**500**) y el detalle técnico va a `error_log`, sin exponer la estructura de la base.
- En el frontend los resultados se insertan con `textContent`, no con `innerHTML`, para evitar XSS si un producto tuviera HTML en el nombre.

### Mismas entradas contra el endpoint seguro

| Entrada | Vulnerable | Seguro |
|---|---|---|
| `mouse` | 1 resultado | 1 resultado |
| `periféricos` | 0 (solo busca en nombre) | 2 (busca en nombre y categoría) |
| `' OR '1'='1` | **4 (toda la tabla)** | 0 — se busca el texto literal |
| `zzz' UNION SELECT ...` | **Filtra datos del servidor** | 0 — se busca el texto literal |
| `%` | 4 (comodín) | 0 — se busca un `%` literal |

---

## Escritura segura — `api/agregar-producto.php`

El formulario **"Agregar producto"** envía un JSON por `fetch` con `POST`. El backend:

1. Acepta solo `POST` (**405** en otro caso) y exige un JSON válido (**400**).
2. Valida cada campo: nombre (1–100 caracteres), categoría (1–50), precio numérico mayor a 0, stock entero ≥ 0. Si algo falla responde **422** con los motivos.
3. Inserta con consulta preparada:

```php
$stmt = $pdo->prepare(
    'INSERT INTO productos (nombre, categoria, precio, stock)
     VALUES (:nombre, :categoria, :precio, :stock)'
);
$stmt->bindValue(':nombre',    $nombre,    PDO::PARAM_STR);
$stmt->bindValue(':categoria', $categoria, PDO::PARAM_STR);
$stmt->bindValue(':precio',    number_format($precio, 2, '.', ''), PDO::PARAM_STR);
$stmt->bindValue(':stock',     $stock,     PDO::PARAM_INT);
$stmt->execute();
```

4. Responde **201** con el `id` generado (`lastInsertId()`). El frontend muestra el mensaje y busca el producto recién creado.

## Conclusión

La inyección SQL ocurre cuando **datos y código viajan juntos** en la misma cadena SQL. Las consultas preparadas de PDO los separan: primero se fija la estructura de la consulta y después se envían los datos. Así, ninguna entrada del usuario puede cambiar lo que la consulta hace, sea de lectura (`SELECT`) o de escritura (`INSERT`).
