/* =========================================================
   AA18 — Tateti (3 fichas por jugador)
   HTML + CSS + JavaScript Vanilla

   Reglas implementadas:
   1. Cada jugador (X / O) tiene 3 fichas.
   2. Fase de COLOCACIÓN: por turnos se coloca una ficha en un punto libre.
   3. Fase de MOVIMIENTO: con las 6 fichas en juego, cada turno se mueve
      una ficha propia al punto libre más cercano (siguiendo las líneas).
   4. Gana quien forma 3 en línea (horizontal, vertical o diagonal).
   5. Empate si el jugador en turno no puede mover o si una misma
      posición se repite 3 veces.
   ========================================================= */

/* ---------------------------------------------------------
   Constantes del tablero
   Índices de los 9 puntos:
     0 | 1 | 2
     3 | 4 | 5
     6 | 7 | 8
   --------------------------------------------------------- */
const FICHAS_POR_JUGADOR = 3;
const REPETICIONES_PARA_EMPATE = 3;
const DEMORA_CPU_MS = 550;

const LINEAS_GANADORAS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // horizontales
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // verticales
  [0, 4, 8], [2, 4, 6],            // diagonales
];

// Puntos "más cercanos" de cada punto, unidos por una línea del tablero
const ADYACENTES = {
  0: [1, 3, 4],
  1: [0, 2, 4],
  2: [1, 5, 4],
  3: [0, 6, 4],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [2, 8, 4],
  6: [3, 7, 4],
  7: [6, 8, 4],
  8: [7, 5, 4],
};

const NOMBRES_PUNTOS = [
  'arriba a la izquierda', 'arriba al centro', 'arriba a la derecha',
  'al medio a la izquierda', 'en el centro', 'al medio a la derecha',
  'abajo a la izquierda', 'abajo al centro', 'abajo a la derecha',
];

const CLAVE_MARCADOR = 'tateti-marcador';

/* ---------------------------------------------------------
   Selección del DOM
   --------------------------------------------------------- */
const tableroEl   = document.querySelector('#tablero');
const estadoEl    = document.querySelector('#estado');
const faseEl      = document.querySelector('#fase');
const selectModo  = document.querySelector('#modo');
const btnNueva    = document.querySelector('#btn-nueva');
const btnReiniciar = document.querySelector('#btn-reiniciar');

/* ---------------------------------------------------------
   Estado del juego (en memoria)
   --------------------------------------------------------- */
const estado = {
  tablero: Array(9).fill(null),      // 'X', 'O' o null
  turno: 'X',
  empiezaPartida: 'X',               // se alterna en cada partida
  fase: 'colocacion',                // 'colocacion' | 'movimiento' | 'fin'
  colocadas: { X: 0, O: 0 },
  seleccionada: null,                // índice de la ficha elegida para mover
  posiciones: new Map(),             // posición → cantidad de veces vista
  modo: '2j',                        // '2j' | 'cpu'
  cpuPensando: false,
  partidaId: 0,                      // evita que una jugada pendiente de la CPU caiga en otra partida
  resultado: {},                     // ganador / línea / motivo del empate al terminar
  marcador: cargarMarcador(),
};

/* ---------------------------------------------------------
   Creación del tablero (9 botones)
   --------------------------------------------------------- */
function crearTablero() {
  const fragmento = document.createDocumentFragment();
  for (let i = 0; i < 9; i++) {
    const punto = document.createElement('button');
    punto.type = 'button';
    punto.className = 'punto';
    punto.dataset.indice = i;
    punto.setAttribute('role', 'gridcell');
    fragmento.appendChild(punto);
  }
  tableroEl.appendChild(fragmento);
}

/* ---------------------------------------------------------
   Lógica pura del juego
   --------------------------------------------------------- */
const rival = (jugador) => (jugador === 'X' ? 'O' : 'X');

function lineaGanadora(tablero, jugador) {
  return LINEAS_GANADORAS.find((linea) => linea.every((i) => tablero[i] === jugador)) || null;
}

function destinosPosibles(tablero, origen) {
  return ADYACENTES[origen].filter((i) => tablero[i] === null);
}

function movimientosPosibles(tablero, jugador) {
  const movimientos = [];
  tablero.forEach((ficha, origen) => {
    if (ficha !== jugador) return;
    destinosPosibles(tablero, origen).forEach((destino) => movimientos.push({ origen, destino }));
  });
  return movimientos;
}

function claveDePosicion() {
  return estado.tablero.map((f) => f || '-').join('') + estado.turno;
}

/* ---------------------------------------------------------
   Acciones del jugador
   --------------------------------------------------------- */
function manejarClickPunto(indice) {
  if (estado.fase === 'fin' || estado.cpuPensando) return;
  if (estado.modo === 'cpu' && estado.turno === 'O') return; // turno de la computadora

  if (estado.fase === 'colocacion') {
    if (estado.tablero[indice] === null) colocarFicha(indice);
    return;
  }

  // Fase de movimiento
  const ficha = estado.tablero[indice];

  if (ficha === estado.turno) {
    // Elegir (o cambiar / soltar) la ficha a mover
    if (estado.seleccionada === indice) {
      estado.seleccionada = null;
    } else if (destinosPosibles(estado.tablero, indice).length > 0) {
      estado.seleccionada = indice;
    } else {
      mostrarAvisoTemporal('Esa ficha está bloqueada: elegí otra.');
      return;
    }
    renderizar();
    return;
  }

  if (ficha === null && estado.seleccionada !== null) {
    if (ADYACENTES[estado.seleccionada].includes(indice)) {
      moverFicha(estado.seleccionada, indice);
    } else {
      mostrarAvisoTemporal('Solo podés mover al punto libre más cercano, siguiendo las líneas.');
    }
  }
}

function colocarFicha(indice) {
  estado.tablero[indice] = estado.turno;
  estado.colocadas[estado.turno]++;
  finalizarJugada();
}

function moverFicha(origen, destino) {
  estado.tablero[destino] = estado.tablero[origen];
  estado.tablero[origen] = null;
  estado.seleccionada = null;
  finalizarJugada();
}

/* Se ejecuta después de cada colocación o movimiento */
function finalizarJugada() {
  const jugador = estado.turno;
  const linea = lineaGanadora(estado.tablero, jugador);

  if (linea) {
    terminarPartida(jugador, linea);
    return;
  }

  // Cambio de fase cuando ambos colocaron sus 3 fichas
  if (estado.fase === 'colocacion'
      && estado.colocadas.X === FICHAS_POR_JUGADOR
      && estado.colocadas.O === FICHAS_POR_JUGADOR) {
    estado.fase = 'movimiento';
  }

  estado.turno = rival(jugador);

  if (estado.fase === 'movimiento') {
    // Empate por bloqueo: el jugador en turno no puede mover
    if (movimientosPosibles(estado.tablero, estado.turno).length === 0) {
      terminarPartida(null, null, `${nombreJugador(estado.turno)} no tiene movimientos posibles.`);
      return;
    }

    // Empate por repetición de la misma posición
    const clave = claveDePosicion();
    const vecesVista = (estado.posiciones.get(clave) || 0) + 1;
    estado.posiciones.set(clave, vecesVista);
    if (vecesVista >= REPETICIONES_PARA_EMPATE) {
      terminarPartida(null, null, 'La misma posición se repitió 3 veces.');
      return;
    }
  }

  renderizar();
  programarTurnoCpu();
}

function terminarPartida(ganador, linea, motivoEmpate = '') {
  estado.fase = 'fin';
  estado.seleccionada = null;

  if (ganador) {
    estado.marcador[ganador]++;
  } else {
    estado.marcador.empates++;
  }
  guardarMarcador();
  estado.resultado = { ganador, linea, motivoEmpate };
  renderizar();
}

function nuevaPartida() {
  estado.tablero = Array(9).fill(null);
  estado.colocadas = { X: 0, O: 0 };
  estado.fase = 'colocacion';
  estado.seleccionada = null;
  estado.posiciones = new Map();
  estado.cpuPensando = false;
  estado.resultado = {};
  estado.partidaId++;
  estado.turno = estado.empiezaPartida;
  // La próxima partida la empieza el otro jugador
  estado.empiezaPartida = rival(estado.empiezaPartida);

  renderizar();
  programarTurnoCpu();
}

/* ---------------------------------------------------------
   Computadora (juega con O)
   --------------------------------------------------------- */
function programarTurnoCpu() {
  if (estado.modo !== 'cpu' || estado.turno !== 'O' || estado.fase === 'fin') return;

  estado.cpuPensando = true;
  renderizar();
  const partida = estado.partidaId;
  setTimeout(() => {
    if (partida !== estado.partidaId) return; // se empezó otra partida mientras pensaba
    if (estado.fase === 'fin' || estado.turno !== 'O' || estado.modo !== 'cpu') {
      estado.cpuPensando = false;
      return;
    }
    estado.cpuPensando = false;
    if (estado.fase === 'colocacion') {
      colocarFicha(elegirColocacionCpu());
    } else {
      const { origen, destino } = elegirMovimientoCpu();
      moverFicha(origen, destino);
    }
  }, DEMORA_CPU_MS);
}

function elegirColocacionCpu() {
  const libres = estado.tablero.map((f, i) => (f === null ? i : null)).filter((i) => i !== null);
  const cpu = 'O';
  const humano = 'X';

  // 1) Ganar  2) Bloquear  3) Centro  4) Esquina  5) Cualquiera
  const completa = (jugador) => libres.find((i) => {
    const prueba = [...estado.tablero];
    prueba[i] = jugador;
    return lineaGanadora(prueba, jugador);
  });

  const ganar = completa(cpu);
  if (ganar !== undefined) return ganar;
  const bloquear = completa(humano);
  if (bloquear !== undefined) return bloquear;
  if (libres.includes(4)) return 4;
  const esquinas = [0, 2, 6, 8].filter((i) => libres.includes(i));
  if (esquinas.length) return azar(esquinas);
  return azar(libres);
}

function elegirMovimientoCpu() {
  const cpu = 'O';
  const humano = 'X';
  const movimientos = movimientosPosibles(estado.tablero, cpu);

  const aplicar = ({ origen, destino }) => {
    const prueba = [...estado.tablero];
    prueba[destino] = prueba[origen];
    prueba[origen] = null;
    return prueba;
  };

  // 1) Movimiento que gana
  const ganador = movimientos.find((m) => lineaGanadora(aplicar(m), cpu));
  if (ganador) return ganador;

  // 2) Movimientos que no le dejan al rival una victoria inmediata
  const seguros = movimientos.filter((m) => {
    const despues = aplicar(m);
    return !movimientosPosibles(despues, humano).some(({ origen, destino }) => {
      const respuesta = [...despues];
      respuesta[destino] = respuesta[origen];
      respuesta[origen] = null;
      return lineaGanadora(respuesta, humano);
    });
  });

  const opciones = seguros.length ? seguros : movimientos;
  // 3) Preferir ocupar el centro
  const alCentro = opciones.filter((m) => m.destino === 4);
  return azar(alCentro.length ? alCentro : opciones);
}

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

/* ---------------------------------------------------------
   Renderizado (mutación del DOM)
   --------------------------------------------------------- */
function nombreJugador(jugador) {
  if (estado.modo === 'cpu') return jugador === 'X' ? 'Vos (X)' : 'La computadora (O)';
  return `Jugador ${jugador}`;
}

function renderizar() {
  const { ganador = null, linea = null, motivoEmpate = '' } = estado.resultado;
  const destinos = estado.seleccionada !== null
    ? destinosPosibles(estado.tablero, estado.seleccionada)
    : [];
  const turnoHumano = estado.fase !== 'fin' && !estado.cpuPensando
    && !(estado.modo === 'cpu' && estado.turno === 'O');

  // Puntos del tablero
  tableroEl.querySelectorAll('.punto').forEach((punto) => {
    const i = Number(punto.dataset.indice);
    const ficha = estado.tablero[i];

    punto.textContent = ficha || '';
    punto.classList.toggle('ficha-x', ficha === 'X');
    punto.classList.toggle('ficha-o', ficha === 'O');
    punto.classList.toggle('seleccionada', estado.seleccionada === i);
    punto.classList.toggle('destino', destinos.includes(i));
    punto.classList.toggle('ganadora', Boolean(linea && linea.includes(i)));
    punto.classList.toggle('movible', turnoHumano && estado.fase === 'movimiento'
      && ficha === estado.turno && destinosPosibles(estado.tablero, i).length > 0);

    // Solo se habilitan los puntos que tienen sentido tocar en este turno
    let habilitado = false;
    if (turnoHumano) {
      if (estado.fase === 'colocacion') habilitado = ficha === null;
      else habilitado = ficha === estado.turno || destinos.includes(i);
    }
    punto.disabled = !habilitado;
    punto.setAttribute('aria-label', `Punto ${NOMBRES_PUNTOS[i]}: ${ficha ? `ficha ${ficha}` : 'libre'}`);
  });

  // Mensaje de estado
  estadoEl.className = 'estado';
  if (estado.fase === 'fin') {
    if (ganador) {
      estadoEl.textContent = `¡${nombreJugador(ganador)} ganó la partida!`;
      estadoEl.classList.add(`estado-gana-${ganador.toLowerCase()}`);
    } else {
      estadoEl.textContent = `Empate. ${motivoEmpate}`;
      estadoEl.classList.add('estado-empate');
    }
  } else if (estado.cpuPensando) {
    estadoEl.textContent = 'La computadora está pensando…';
  } else if (estado.fase === 'colocacion') {
    estadoEl.textContent = `${nombreJugador(estado.turno)}: colocá una ficha en un punto libre.`;
  } else if (estado.seleccionada === null) {
    estadoEl.textContent = `${nombreJugador(estado.turno)}: elegí una de tus fichas para mover.`;
  } else {
    estadoEl.textContent = `${nombreJugador(estado.turno)}: tocá un punto marcado para mover la ficha.`;
  }

  // Fase y fichas en reserva
  faseEl.textContent = estado.fase === 'colocacion' ? 'Colocación'
    : estado.fase === 'movimiento' ? 'Movimiento' : 'Fin';

  ['X', 'O'].forEach((jugador) => {
    const reserva = document.querySelector(`[data-reserva="${jugador}"]`);
    const restantes = FICHAS_POR_JUGADOR - estado.colocadas[jugador];
    reserva.replaceChildren(...Array.from({ length: restantes }, () => {
      const ficha = document.createElement('span');
      ficha.className = 'reserva-ficha';
      ficha.textContent = jugador;
      return ficha;
    }));

    const item = document.querySelector(`.marcador-item[data-jugador="${jugador}"]`);
    item.classList.toggle('en-turno', estado.fase !== 'fin' && estado.turno === jugador);
    document.querySelector(`[data-nombre="${jugador}"]`).textContent = nombreJugador(jugador);
  });

  // Marcador
  document.querySelector('[data-puntos="X"]').textContent = estado.marcador.X;
  document.querySelector('[data-puntos="O"]').textContent = estado.marcador.O;
  document.querySelector('[data-puntos="empates"]').textContent = estado.marcador.empates;
}

let temporizadorAviso = null;
function mostrarAvisoTemporal(texto) {
  estadoEl.textContent = texto;
  estadoEl.className = 'estado estado-aviso';
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => renderizar(), 1800);
}

/* ---------------------------------------------------------
   Marcador persistente (localStorage)
   --------------------------------------------------------- */
function cargarMarcador() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_MARCADOR));
    if (guardado && Number.isInteger(guardado.X) && Number.isInteger(guardado.O)
        && Number.isInteger(guardado.empates)) {
      return guardado;
    }
  } catch {
    /* sin almacenamiento disponible: se empieza de cero */
  }
  return { X: 0, O: 0, empates: 0 };
}

function guardarMarcador() {
  try {
    localStorage.setItem(CLAVE_MARCADOR, JSON.stringify(estado.marcador));
  } catch {
    /* sin almacenamiento: el marcador vale solo mientras la página esté abierta */
  }
}

/* ---------------------------------------------------------
   Eventos (addEventListener, sin onclick en el HTML)
   --------------------------------------------------------- */
// Delegación: un único listener en el tablero para los 9 puntos
tableroEl.addEventListener('click', (evento) => {
  const punto = evento.target.closest('.punto');
  if (punto && !punto.disabled) manejarClickPunto(Number(punto.dataset.indice));
});

btnNueva.addEventListener('click', nuevaPartida);

btnReiniciar.addEventListener('click', () => {
  estado.marcador = { X: 0, O: 0, empates: 0 };
  guardarMarcador();
  estado.empiezaPartida = 'X';
  nuevaPartida();
});

selectModo.addEventListener('change', () => {
  estado.modo = selectModo.value;
  estado.empiezaPartida = 'X';
  nuevaPartida();
});

/* ---------------------------------------------------------
   Inicio
   --------------------------------------------------------- */
crearTablero();
estado.modo = selectModo.value;
nuevaPartida();
