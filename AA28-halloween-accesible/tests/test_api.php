<?php
/**
 * Pruebas automáticas de la API REST — AA28
 *
 * Cómo correrlas (con Apache y MySQL encendidos en XAMPP):
 *   C:\xampp\php\php.exe tests\test_api.php
 *   C:\xampp\php\php.exe tests\test_api.php http://localhost/halloween/
 *
 * Qué hace: registra un usuario de prueba, vota y quita el voto, intenta ataques
 * (inyección SQL, voto duplicado, acceso sin permiso, archivo SVG) y prueba el CRUD
 * del administrador. Al final borra el disfraz de prueba que creó.
 * El usuario de prueba (test_xxxx) queda registrado: la API no permite borrar usuarios.
 */

// Solo se ejecuta desde la consola: desde el navegador no hace nada
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Este script se ejecuta desde la consola: php tests/test_api.php');
}

$BASE        = rtrim($argv[1] ?? 'http://localhost/halloween/', '/') . '/';
$ADMIN_USER  = 'admin';
$ADMIN_CLAVE = 'Halloween2026!';

$aprobadas = 0;
$fallidas  = 0;
$tiempos   = [];

/* ---------------------------------------------------------
   Cliente HTTP mínimo con manejo de cookies (sesión)
   --------------------------------------------------------- */
function peticion(string $metodo, string $ruta, array $opciones = [], array &$cookies = []): array
{
    global $BASE, $tiempos;

    $cabeceras = ['Accept: application/json'];
    if (!isset($opciones['sin_csrf'])) {
        $cabeceras[] = 'X-Requested-With: fetch';
    }
    if ($cookies) {
        $cabeceras[] = 'Cookie: ' . implode('; ', array_map(fn($k, $v) => "$k=$v", array_keys($cookies), $cookies));
    }
    $cuerpo = '';
    if (isset($opciones['json'])) {
        $cabeceras[] = 'Content-Type: application/json';
        $cuerpo = json_encode($opciones['json']);
    } elseif (isset($opciones['multipart'])) {
        $limite = '----PruebaAA28' . bin2hex(random_bytes(6));
        $cabeceras[] = "Content-Type: multipart/form-data; boundary=$limite";
        foreach ($opciones['multipart'] as $campo => $valor) {
            $cuerpo .= "--$limite\r\n";
            if (is_array($valor)) { // archivo: [nombre, tipo, bytes]
                $cuerpo .= "Content-Disposition: form-data; name=\"$campo\"; filename=\"{$valor[0]}\"\r\n";
                $cuerpo .= "Content-Type: {$valor[1]}\r\n\r\n{$valor[2]}\r\n";
            } else {
                $cuerpo .= "Content-Disposition: form-data; name=\"$campo\"\r\n\r\n$valor\r\n";
            }
        }
        $cuerpo .= "--$limite--\r\n";
    }
    foreach ($opciones['cabeceras'] ?? [] as $extra) {
        $cabeceras[] = $extra;
    }

    $contexto = stream_context_create(['http' => [
        'method'        => $metodo,
        'header'        => implode("\r\n", $cabeceras),
        'content'       => $cuerpo,
        'ignore_errors' => true,   // permite leer el cuerpo de las respuestas 4xx y 5xx
        'timeout'       => 15,
    ]]);

    $inicio = microtime(true);
    $respuesta = @file_get_contents($BASE . $ruta, false, $contexto);
    $ms = (microtime(true) - $inicio) * 1000;
    $tiempos[] = $ms;

    if ($respuesta === false && empty($http_response_header)) {
        fwrite(STDERR, "\nNo se pudo conectar con $BASE. ¿Está encendido Apache?\n");
        exit(2);
    }

    preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0] ?? '', $m);
    foreach ($http_response_header as $linea) {
        if (stripos($linea, 'Set-Cookie:') === 0 && preg_match('/Set-Cookie:\s*([^=]+)=([^;]*)/i', $linea, $c)) {
            $cookies[$c[1]] = $c[2];
        }
    }

    return [
        'codigo'    => (int) ($m[1] ?? 0),
        'json'      => json_decode((string) $respuesta, true),
        'cabeceras' => $http_response_header,
        'ms'        => $ms,
    ];
}

function probar(string $descripcion, bool $condicion, string $detalle = ''): void
{
    global $aprobadas, $fallidas;
    if ($condicion) {
        $aprobadas++;
        echo "  [OK]    $descripcion\n";
    } else {
        $fallidas++;
        echo "  [FALLA] $descripcion" . ($detalle ? "  → $detalle" : '') . "\n";
    }
}

// Imagen PNG válida de 1x1 píxel y un SVG con script (debe rechazarse)
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
$svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';

echo "\nPruebas de la API — $BASE\n";

/* ---------------------------------------------------------
   1. Lectura pública
   --------------------------------------------------------- */
echo "\n1. Listado público (Adecuación funcional)\n";
$r = peticion('GET', 'api/disfraces.php');
probar('GET api/disfraces.php responde 200 con JSON', $r['codigo'] === 200 && ($r['json']['estado'] ?? '') === 'exito', "código {$r['codigo']}");
$disfraces = $r['json']['data'] ?? [];
probar('El listado trae disfraces desde MySQL', count($disfraces) > 0);
$votos = array_column($disfraces, 'votos');
$ordenados = $votos;
rsort($ordenados);
probar('El listado está ordenado por votos (ranking)', $votos === $ordenados);
$idDisfraz = $disfraces[0]['id'] ?? 1;

$r = peticion('GET', 'api/disfraces.php?id=999999');
probar('Disfraz inexistente → 404', $r['codigo'] === 404, "código {$r['codigo']}");
$r = peticion('GET', 'api/disfraces.php?id=abc');
probar('Id no numérico → 400', $r['codigo'] === 400, "código {$r['codigo']}");

if (!empty($disfraces[0]['foto_url'])) {
    $r = peticion('GET', $disfraces[0]['foto_url']);
    $tipo = implode(' ', preg_grep('/^Content-Type:/i', $r['cabeceras']));
    probar('La foto se sirve desde el BLOB como imagen', $r['codigo'] === 200 && stripos($tipo, 'image/') !== false, $tipo);
}

/* ---------------------------------------------------------
   2. Seguridad
   --------------------------------------------------------- */
echo "\n2. Seguridad (OWASP)\n";
$r = peticion('POST', 'api/votos.php', ['json' => ['id_disfraz' => $idDisfraz]]);
probar('Votar sin sesión → 401', $r['codigo'] === 401, "código {$r['codigo']}");

$r = peticion('POST', 'api/login.php', ['json' => ['nombre' => "admin' OR '1'='1", 'clave' => "' OR '1'='1"]]);
probar('Inyección SQL en el login es rechazada → 401', $r['codigo'] === 401, "código {$r['codigo']}");

$r = peticion('POST', 'api/login.php', ['json' => ['nombre' => 'admin', 'clave' => 'incorrecta']]);
probar('Contraseña incorrecta → 401 con mensaje genérico', $r['codigo'] === 401 && str_contains($r['json']['mensaje'] ?? '', 'Usuario o contraseña'));

$r = peticion('POST', 'api/login.php', ['json' => ['nombre' => 'admin', 'clave' => $ADMIN_CLAVE], 'sin_csrf' => true]);
probar('Petición sin cabecera anti-CSRF → 403', $r['codigo'] === 403, "código {$r['codigo']}");

/* ---------------------------------------------------------
   3. Usuario registrado
   --------------------------------------------------------- */
echo "\n3. Registro, login y votos\n";
$usuario = 'test_' . substr(bin2hex(random_bytes(3)), 0, 6);
$sesionUsuario = [];
$r = peticion('POST', 'api/registro.php', ['json' => ['nombre' => $usuario, 'clave' => 'prueba1234']], $sesionUsuario);
probar("Registro de '$usuario' → 201 e inicia sesión", $r['codigo'] === 201 && ($r['json']['usuario']['nombre'] ?? '') === $usuario, "código {$r['codigo']}");

$r = peticion('POST', 'api/registro.php', ['json' => ['nombre' => $usuario, 'clave' => 'prueba1234']]);
probar('Registrar el mismo usuario otra vez → 409', $r['codigo'] === 409, "código {$r['codigo']}");

$r = peticion('POST', 'api/registro.php', ['json' => ['nombre' => 'ab', 'clave' => '123']]);
probar('Registro con datos inválidos → 400', $r['codigo'] === 400, "código {$r['codigo']}");

$sesionLogin = [];
$r = peticion('POST', 'api/login.php', ['json' => ['nombre' => $usuario, 'clave' => 'prueba1234']], $sesionLogin);
probar('Login con la contraseña correcta (password_verify) → 200', $r['codigo'] === 200, "código {$r['codigo']}");
$cookie = implode(' ', preg_grep('/^Set-Cookie:/i', $r['cabeceras']));
probar('La cookie de sesión es HttpOnly y SameSite', stripos($cookie, 'httponly') !== false && stripos($cookie, 'samesite') !== false, $cookie);

$votosAntes = null;
foreach ($disfraces as $d) { if ($d['id'] === $idDisfraz) $votosAntes = $d['votos']; }

$r = peticion('POST', 'api/votos.php', ['json' => ['id_disfraz' => $idDisfraz]], $sesionUsuario);
probar('Votar con sesión → 201', $r['codigo'] === 201, "código {$r['codigo']}");
probar('El contador de votos sube en 1', ($r['json']['votos'] ?? null) === $votosAntes + 1, json_encode($r['json']));

$r = peticion('POST', 'api/votos.php', ['json' => ['id_disfraz' => $idDisfraz]], $sesionUsuario);
probar('Voto duplicado → 409', $r['codigo'] === 409, "código {$r['codigo']}");

$r = peticion('DELETE', "api/votos.php?id_disfraz=$idDisfraz", [], $sesionUsuario);
probar('Quitar el voto → 200 y el contador vuelve al valor anterior', $r['codigo'] === 200 && ($r['json']['votos'] ?? null) === $votosAntes, "código {$r['codigo']}");

$r = peticion('DELETE', "api/disfraces.php?id=$idDisfraz", [], $sesionUsuario);
probar('Un usuario común no puede borrar disfraces → 403', $r['codigo'] === 403, "código {$r['codigo']}");

$r = peticion('POST', 'api/disfraces.php', ['multipart' => ['nombre' => 'SVG', 'descripcion' => 'x', 'foto' => ['x.svg', 'image/jpeg', $svg]]], $sesionUsuario);
probar('Subir un SVG con script es rechazado → 415', $r['codigo'] === 415, "código {$r['codigo']}");

$r = peticion('GET', 'admin.php', [], $sesionUsuario);
probar('Un usuario común no puede abrir admin.php → 403', $r['codigo'] === 403, "código {$r['codigo']}");

/* ---------------------------------------------------------
   4. CRUD del administrador
   --------------------------------------------------------- */
echo "\n4. CRUD del administrador\n";
$sesionAdmin = [];
$r = peticion('POST', 'api/login.php', ['json' => ['nombre' => $ADMIN_USER, 'clave' => $ADMIN_CLAVE]], $sesionAdmin);
probar('Login del administrador → 200', $r['codigo'] === 200 && !empty($r['json']['usuario']['es_admin']), "código {$r['codigo']}");

$r = peticion('POST', 'api/disfraces.php', ['multipart' => ['nombre' => 'Disfraz de prueba', 'descripcion' => 'Creado por test_api.php', 'foto' => ['p.png', 'image/png', $png]]], $sesionAdmin);
$idNuevo = $r['json']['data']['id'] ?? null;
probar('Crear disfraz con foto → 201', $r['codigo'] === 201 && $idNuevo, "código {$r['codigo']}");

$r = peticion('PUT', "api/disfraces.php?id=$idNuevo", ['json' => ['nombre' => 'Disfraz de prueba (editado)', 'descripcion' => 'Editado']], $sesionAdmin);
probar('Editar disfraz (PUT) → 200', $r['codigo'] === 200 && ($r['json']['data']['nombre'] ?? '') === 'Disfraz de prueba (editado)', "código {$r['codigo']}");

$r = peticion('DELETE', "api/disfraces.php?id=$idNuevo", [], $sesionAdmin);
probar('Enviar a la papelera (borrado lógico) → 200', $r['codigo'] === 200, "código {$r['codigo']}");

$r = peticion('GET', "api/disfraces.php?id=$idNuevo");
probar('El disfraz en la papelera ya no es visible para el público → 404', $r['codigo'] === 404, "código {$r['codigo']}");

$r = peticion('DELETE', "api/disfraces.php?id=$idNuevo&definitivo=1", [], $sesionAdmin);
probar('Borrado definitivo → 200 (limpieza de la prueba)', $r['codigo'] === 200, "código {$r['codigo']}");

$r = peticion('PATCH', "api/disfraces.php?id=$idDisfraz", [], $sesionAdmin);
probar('Método no soportado → 405', $r['codigo'] === 405, "código {$r['codigo']}");

/* ---------------------------------------------------------
   5. Desempeño
   --------------------------------------------------------- */
echo "\n5. Eficiencia de desempeño\n";
$muestras = [];
for ($i = 0; $i < 20; $i++) {
    $muestras[] = peticion('GET', 'api/disfraces.php')['ms'];
}
sort($muestras);
$promedio = array_sum($muestras) / count($muestras);
$p95 = $muestras[(int) floor(count($muestras) * 0.95) - 1];
printf("  GET api/disfraces.php × 20: promedio %.1f ms · p95 %.1f ms · máximo %.1f ms\n", $promedio, $p95, max($muestras));
probar('El listado responde en menos de 500 ms (p95)', $p95 < 500, sprintf('%.1f ms', $p95));

/* ---------------------------------------------------------
   Resumen
   --------------------------------------------------------- */
$total = $aprobadas + $fallidas;
echo "\nResultado: $aprobadas de $total pruebas aprobadas" . ($fallidas ? " · $fallidas fallidas" : '') . "\n\n";
exit($fallidas ? 1 : 0);
