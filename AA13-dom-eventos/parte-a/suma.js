/* =========================================================
   AA13 · Parte A — Sumatoria de dos valores
   Captura de eventos, lectura de inputs y mutación del DOM
   ========================================================= */

// 1) Selección de los nodos del DOM
const formSuma  = document.querySelector('#form-suma');
const inputUno  = document.querySelector('#valor1');
const inputDos  = document.querySelector('#valor2');
const resultado = document.querySelector('#resultado');

function calcularSuma() {
  // 2) Lectura de los valores ingresados.
  //    .value siempre devuelve texto: "5" + "3" daría "53".
  //    Por eso se convierte a número con parseFloat antes de sumar.
  const valorUno = parseFloat(inputUno.value);
  const valorDos = parseFloat(inputDos.value);

  // Se limpian las clases del cálculo anterior
  resultado.classList.remove('positivo', 'cero', 'negativo', 'pendiente');

  // Validación: si algún campo está vacío o no es número, no se calcula
  if (Number.isNaN(valorUno) || Number.isNaN(valorDos)) {
    resultado.textContent = 'Completá ambos valores';
    resultado.classList.add('pendiente');
    return;
  }

  // 3) Cálculo en memoria (variable local)
  //    Se redondea a 2 decimales para evitar resultados como 0.1 + 0.2 = 0.30000000000000004
  const suma = Math.round((valorUno + valorDos) * 100) / 100;

  // 4) Inyección del resultado en el <span id="resultado"> según su signo
  if (suma > 0) {
    resultado.textContent = `${suma} → el valor es POSITIVO`;
    resultado.classList.add('positivo');
  } else if (suma === 0) {
    resultado.textContent = `${suma} → el valor es CERO`;
    resultado.classList.add('cero');
  } else {
    resultado.textContent = `${suma} → el valor es NEGATIVO`;
    resultado.classList.add('negativo');
  }
}

// 5) Captura de eventos con addEventListener
// Botón "Calcular": se evita que el formulario recargue la página
formSuma.addEventListener('submit', (evento) => {
  evento.preventDefault();
  calcularSuma();
});

// Además, el resultado se actualiza en tiempo real mientras se escribe
inputUno.addEventListener('input', calcularSuma);
inputDos.addEventListener('input', calcularSuma);

// Estado inicial
calcularSuma();
