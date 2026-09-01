<?php
// Comprobamos que el formulario se haya enviado por el método POST
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // Capturamos los datos enviados desde el formulario
    $nombre = htmlspecialchars($_POST['nombre']);
    $direccion = htmlspecialchars($_POST['direccion']);
    $telefono = htmlspecialchars($_POST['telefono']);
    $email = htmlspecialchars($_POST['email']);
    $medio_pago = htmlspecialchars($_POST['medio_pago']);
    $productos = htmlspecialchars($_POST['productos']);

    // Acá iría la lógica para guardar en base de datos, pero por ahora solo mostramos el resumen
    echo "<h2>¡Gracias por tu compra, $nombre!</h2>";
    echo "<h3>Resumen de tu pedido:</h3>";
    echo "<ul>";
    echo "<li><strong>Dirección de envío:</strong> $direccion</li>";
    echo "<li><strong>Teléfono:</strong> $telefono</li>";
    echo "<li><strong>E-mail:</strong> $email</li>";
    echo "<li><strong>Medio de Pago:</strong> $medio_pago</li>";
    echo "<li><strong>Productos seleccionados:</strong><br> " . nl2br($productos) . "</li>";
    echo "</ul>";
    
    echo '<br><a href="index.html">Volver al inicio</a>';
} else {
    // Si alguien intenta entrar directo al PHP sin pasar por el formulario
    echo "Acceso denegado. Por favor, completa el formulario de compra.";
}
?>