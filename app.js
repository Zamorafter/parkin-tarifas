const API_USD = 'https://ve.dolarapi.com/v1/dolares/oficial';
const API_EUR = 'https://ve.dolarapi.com/v1/euros/oficial';

// Tarifas fijas en USD
const TARIFAS_USD = {
    plana: 3.97,
    vip: 10,
    perdido: 8
};

// Utilidad para formatear números a formato venezolano (ej. 1.234,56)
function formatCurrency(number) {
    return number.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FECHA_TZ = 'America/Caracas';
const fmtFechaValor = new Intl.DateTimeFormat('es-VE', {
    timeZone: FECHA_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});
const fmtFechaSundde = new Intl.DateTimeFormat('es-VE', {
    timeZone: FECHA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
});

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Fecha del día en Venezuela (no depende de fechaActualizacion del BCV ni del reloj local del TV)
function updateFechaDisplay() {
    const ahora = new Date();
    const formattedDate = capitalizar(fmtFechaValor.format(ahora));

    document.getElementById('fecha-valor-bs').innerText = formattedDate;
    document.getElementById('fecha-valor-ref').innerText = formattedDate;

    let fSundde = capitalizar(fmtFechaSundde.format(ahora));
    document.getElementById('sundde-fecha').innerHTML =
        fSundde.replace(/ de /g, ' de<br>');
}

// Realiza los cálculos según fórmula contable del usuario
// Total = Tarifa * Tasa
// Base = Total / 1.16
// IVA = Total - Base
function calcularDesglose(tarifaUSD, tasaBCV) {
    const total = tarifaUSD * tasaBCV;
    const base = total / 1.16;
    const iva = total - base;

    return {
        base: formatCurrency(base),
        iva: formatCurrency(iva),
        total: formatCurrency(total)
    };
}

async function fetchData() {
    try {
        const [resUSD, resEUR] = await Promise.all([
            fetch(API_USD),
            fetch(API_EUR)
        ]);

        const dataUSD = await resUSD.json();
        const dataEUR = await resEUR.json();

        updateUI(dataUSD, dataEUR);
    } catch (error) {
        console.error('Error al obtener los datos del BCV:', error);
        // Si hay error, intentamos nuevamente en 5 minutos
        setTimeout(fetchData, 5 * 60 * 1000);
    }
}

function updateUI(dataUSD, dataEUR) {
    const tasaUSD = dataUSD.promedio;
    const tasaEUR = dataEUR.promedio;

    updateFechaDisplay();

    // Actualizar Tasas BCV UI
    const strTasaUSD = formatCurrency(tasaUSD);
    const strTasaEUR = formatCurrency(tasaEUR);

    document.getElementById('bcv-rate-bs').innerText = strTasaUSD;
    document.getElementById('bcv-rate-ref').innerText = strTasaUSD;
    document.getElementById('sundde-usd').innerText = strTasaUSD;
    document.getElementById('sundde-eur').innerText = strTasaEUR;

    // Calcular Tarifas
    const calcPlana = calcularDesglose(TARIFAS_USD.plana, tasaUSD);
    const calcVIP = calcularDesglose(TARIFAS_USD.vip, tasaUSD);
    const calcPerdido = calcularDesglose(TARIFAS_USD.perdido, tasaUSD);

    // Actualizar UI Slide 1 (Bs)
    document.getElementById('tp-base').innerText = calcPlana.base;
    document.getElementById('tp-iva').innerText = calcPlana.iva;
    document.getElementById('tp-total').innerText = calcPlana.total;

    document.getElementById('vip-base').innerText = calcVIP.base;
    document.getElementById('vip-iva').innerText = calcVIP.iva;
    document.getElementById('vip-total').innerText = calcVIP.total;

    document.getElementById('tk-base').innerText = calcPerdido.base;
    document.getElementById('tk-iva').innerText = calcPerdido.iva;
    document.getElementById('tk-total').innerText = calcPerdido.total;
}

// Lógica de Carrusel
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');

function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
}

// Lógica de Integridad para Sistema Permanente
// Verifica la hora cada minuto. Si son las 06:05 am, recarga toda la página.
// Esto libera la memoria RAM del navegador (memory leaks) y obtiene las tasas nuevas limpiamente.
function getHoraCaracas() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: FECHA_TZ,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(new Date());
    return {
        hours: Number(parts.find((p) => p.type === 'hour').value),
        minutes: Number(parts.find((p) => p.type === 'minute').value)
    };
}

function checkAutoReload() {
    updateFechaDisplay();

    const { hours, minutes } = getHoraCaracas();
    // 6:05 AM Venezuela (damos 5 min para que la API del BCV actualice)
    if (hours === 6 && minutes === 5) {
        console.log("Realizando recarga diaria de integridad...");
        window.location.reload(true);
    }
}

// Inicialización
function init() {
    updateFechaDisplay();

    fetchData();

    setInterval(nextSlide, 5000);
    setInterval(checkAutoReload, 60000);
}

// Arrancar sistema
init();
