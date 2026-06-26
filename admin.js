/**
 * admin.js - Controlador Lógico del Panel de Administración y CRM
 * Conecta admin.html con la API de Google Sheets y gestiona las analíticas.
 */

// Estado global del panel
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const recordsPerPage = 10;
let selectedOrder = null;
let activeView = 'overview';
let activeStatusFilter = 'todos';

// Instancias de gráficos para evitar superposiciones (ghosting)
let salesChartInstance = null;
let categoriesChartInstance = null;
let hoursChartInstance = null;
let weekdaysChartInstance = null;
let paymentsChartInstance = null;
let zonesChartInstance = null;

// Audio context y pop sintético para micro-interacciones
let audioCtx = null;

function playPopSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.09);
  } catch (e) {
    console.warn("AudioContext no soportado o bloqueado.");
  }
}

// ─── CONTROL DE INICIO DE SESIÓN ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Comprobar si ya hay sesión iniciada
  const isLogged = sessionStorage.getItem("p25_admin_logged") === "true";
  if (isLogged) {
    document.getElementById("loginOverlay").classList.add("hidden");
    initDashboard();
  }

  // Escuchar tecla Enter en el formulario de login
  document.getElementById("passwordInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") validateLogin();
  });

  // Mostrar fecha actual
  updateDateDisplay();
  
  // Sincronizar tema con la preferencia del sistema o localStorage
  initTheme();
});

function updateDateDisplay() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const today = new Date();
  document.getElementById("currentDateText").textContent = 
    today.toLocaleDateString('es-AR', options).replace(/^\w/, c => c.toUpperCase()) + 
    ' · San Miguel de Tucumán';
}

function validateLogin() {
  const user = document.getElementById("usernameInput").value.trim();
  const pass = document.getElementById("passwordInput").value.trim();
  const errorEl = document.getElementById("loginError");

  if (user === "admin" && pass === "123456") {
    playPopSound();
    sessionStorage.setItem("p25_admin_logged", "true");
    document.getElementById("loginOverlay").classList.add("hidden");
    showToast("🔓 Acceso autorizado. Cargando panel...", "🔑");
    initDashboard();
  } else {
    errorEl.style.display = "block";
    errorEl.classList.add("bump");
    setTimeout(() => errorEl.classList.remove("bump"), 500);
    // Limpiar clave
    document.getElementById("passwordInput").value = "";
  }
}

function logout() {
  sessionStorage.removeItem("p25_admin_logged");
  location.reload();
}

// ─── INICIALIZACIÓN Y CARGA DE DATOS ─────────────────────────────────
function initDashboard() {
  fetchData();
  renderCatalog();
}

async function fetchData() {
  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.classList.add("loading");
    syncBtn.disabled = true;
  }
  
  const connBadge = document.getElementById("connBadge");
  const connBadgeText = document.getElementById("connBadgeText");

  try {
    // Intentar consultar el Google Sheets del cliente con un límite de tiempo (Timeout) de 3.5 segundos
    console.log("Conectando con Google Sheets Apps Script:", GOOGLE_SHEETS_URL);
    
    // Si la URL es la de reemplazo o está vacía, saltar directo al fallback
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar") || GOOGLE_SHEETS_URL === "") {
      throw new Error("URL de Google Sheets no configurada");
    }

    const response = await Promise.race([
      fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getOrders" })
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout en la red")), 3500))
    ]);

    if (!response.ok) {
      throw new Error("Error HTTP " + response.status);
    }

    const result = await response.json();
    if (result && result.status === "success" && result.data) {
      // Éxito real en Google Sheets
      allOrders = result.data;
      
      // Mapear campos si difieren (ej: de Capelli a Punto 25)
      allOrders = allOrders.map(o => normalizeOrderData(o));

      console.log("Datos obtenidos de Google Sheets:", allOrders.length, "registros.");
      
      connBadge.className = "connection-badge connected";
      connBadgeText.textContent = "Sheets Conectado";
      showToast("Planilla sincronizada con éxito", "🟢");
    } else {
      throw new Error("Respuesta inválida del servidor");
    }
  } catch (err) {
    console.warn("Fallo en la sincronización remota (" + err.message + "). Iniciando simulación local...");
    
    // Cargar desde localStorage o generar mock data
    const saved = localStorage.getItem("p25_orders_db");
    if (saved) {
      allOrders = JSON.parse(saved);
      console.log("Cargadas órdenes simuladas desde localStorage:", allOrders.length);
    } else {
      allOrders = generateMockSales();
      localStorage.setItem("p25_orders_db", JSON.stringify(allOrders));
      console.log("Generadas 100 órdenes de prueba nuevas.");
    }
    
    connBadge.className = "connection-badge offline";
    connBadgeText.textContent = "Simulación Local";
    showToast("Datos locales de simulación cargados", "🟡");
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove("loading");
      syncBtn.disabled = false;
    }
    
    // Ordenar de más nuevo a más viejo
    allOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Refrescar vistas
    filterData();
    updateDashboardMetrics();
  }
}

// Normaliza un número de teléfono removiendo espacios, guiones, + y paréntesis para agrupar clientes correctamente
function normalizePhone(phone) {
  return phone.toString().replace(/[\s\-\+\(\)\.]/g, '').trim();
}

// Normaliza las columnas leídas del sheet por si hay discrepancias entre las del script de carga y las de app.js
function normalizeOrderData(order) {
  // Asegurar que el total sea numérico y no falle por formateo de moneda del sheet
  let rawTotal = order.total || order.total_estimado || 0;
  let parsedTotal = 0;
  if (typeof rawTotal === 'number') {
    parsedTotal = rawTotal;
  } else if (rawTotal) {
    // Quitar signo de peso, espacios y formateo
    let clean = String(rawTotal).replace(/[^0-9,\.-]/g, '');
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      const parts = clean.split(',');
      if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(',', '.');
      }
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace(/\./g, '');
      }
    }
    const parsed = parseFloat(clean);
    parsedTotal = isNaN(parsed) ? 0 : parsed;
  }

  // Asegurar que las llaves correspondan a Punto 25
  return {
    orderId: order.orderId || order.numero_de_solicitud || `#25-UNKN`,
    timestamp: order.timestamp || order.date || order.fecha || new Date().toISOString(),
    nombre: order.nombre || order.nombre_del_cliente || "Cliente Sin Nombre",
    tel: order.tel || order.telefono || "--",
    deliveryMode: order.deliveryMode || order.metodo_de_entrega || "🛵 Delivery",
    direccion: order.direccion || order.sucursal___direccion || "Domicilio No Especificado",
    paymentMethod: order.paymentMethod || order.medio_de_pago || "💵 Efectivo",
    detalle: order.detalle || order.productos_detalle || "Detalle Vacío",
    total: parsedTotal,
    pagoDetalle: order.pagoDetalle || order.pago_detalle || "N/A",
    notes: order.notes || order.observaciones || "",
    estado: order.estado || "Pendiente"
  };
}

// ─── GENERADOR DE VENTAS MOCK (100 Ventas) ───────────────────────────
function generateMockSales() {
  const list = [];
  const names = ["Sofía", "Martín", "Ana", "Carlos", "María", "Esteban", "Laura", "Lucas", "Florencia", "Diego", "Valentina", "Facundo", "Camila", "Juan", "Victoria", "Gonzalo", "Agustina", "Matias", "Juliana", "Federico"];
  const surnames = ["López", "Rodríguez", "González", "Fernández", "Díaz", "Gómez", "Pérez", "Sánchez", "Romero", "Álvarez", "Ruiz", "Torres", "Juárez", "Sosa", "Benítez", "Maldonado", "Mansilla", "Acosta", "Rios", "Medina"];
  
  const streets = ["Av. Aconquija", "Laprida", "Salta", "Corrientes", "Av. Mate de Luna", "Marcos Paz", "Av. Perón", "Santa Fe", "Muñecas", "Av. Mitre", "Balcarce", "San Martín", "Lobo de la Vega", "Chacabuco", "Pellegrini"];
  const deliveryModes = ["🛵 Delivery", "🏃 Retiro"];
  const paymentMethods = ["💵 Efectivo", "📱 Transferencia"];
  const statuses = ["Entregado", "Entregado", "Entregado", "Entregado", "Enviado", "En Preparación", "Pendiente", "Cancelado"]; // Sesgo hacia entregados

  // Catálogo simplificado leído de data.js para mapear categorías y precios
  const itemsPool = MENU; // MENU es global de data.js

  const now = new Date();
  
  for (let i = 0; i < 100; i++) {
    const orderId = `#25-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const name = `${names[Math.floor(Math.random() * names.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`;
    const phone = `381${Math.floor(1000000 + Math.random() * 9000000)}`;
    
    // Distribución de fechas en los últimos 30 días
    const orderDate = new Date();
    const daysAgo = Math.floor(Math.random() * 30);
    orderDate.setDate(now.getDate() - daysAgo);
    
    // Simular horas pico (alrededor del mediodía 12:00-13:30 o noche 19:30-22:00)
    let hour = 20;
    const hourRoll = Math.random();
    if (hourRoll < 0.5) {
      hour = 19 + Math.floor(Math.random() * 3); // 19, 20, 21
    } else if (hourRoll < 0.8) {
      hour = 11 + Math.floor(Math.random() * 3); // 11, 12, 13
    } else {
      hour = 9 + Math.floor(Math.random() * 12); // Resto del día
    }
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    orderDate.setHours(hour, minute, second);

    const deliveryMode = deliveryModes[Math.random() < 0.75 ? 0 : 1];
    let address = "Retiro en Local (Corrientes 664)";
    if (deliveryMode === "🛵 Delivery") {
      address = `${streets[Math.floor(Math.random() * streets.length)]} ${Math.floor(100 + Math.random() * 2500)}`;
      if (Math.random() < 0.3) {
        address += `, Piso ${Math.floor(1 + Math.random() * 10)} Dpto ${["A", "B", "C", "D"][Math.floor(Math.random() * 4)]}`;
      }
      if (Math.random() < 0.4) {
        address += " (Yerba Buena)";
      } else {
        address += " (Barrio Norte)";
      }
    }

    const paymentMethod = paymentMethods[Math.random() < 0.6 ? 0 : 1];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Generar de 1 a 3 ítems del menú reales
    const itemsCount = Math.floor(1 + Math.random() * 3);
    const selectedItems = [];
    let total = 0;
    const itemsLines = [];

    // Elegir aleatoriamente del catálogo
    const shuffledItems = [...itemsPool].sort(() => 0.5 - Math.random());
    
    for (let j = 0; j < Math.min(itemsCount, shuffledItems.length); j++) {
      const p = shuffledItems[j];
      const qty = Math.floor(1 + Math.random() * 2);
      let price = p.price;
      let optText = "";
      
      if (p.unitType === "peso") {
        const isKilo = Math.random() < 0.5;
        price = isKilo ? p.price : p.priceHalf;
        optText = isKilo ? " (1kg)" : " (500g)";
      } else if (p.unitType === "mixto") {
        const roll = Math.random();
        if (roll < 0.33) {
          price = p.priceHalf;
          optText = " (500g)";
        } else if (roll < 0.66) {
          price = p.price;
          optText = " (1kg)";
        } else {
          price = p.priceUnit;
          optText = " (Unidad)";
        }
      } else {
        let suffix = "Unidad";
        if (p.cat === "almacen-huevos" && p.id === 46) suffix = "Bandeja";
        optText = ` (${suffix})`;
      }

      total += price * qty;
      itemsLines.push(`${qty}x ${p.emoji} ${p.name}${optText} — $${(price * qty).toLocaleString('es-AR')}`);
    }

    let pagoDetalle = "N/A";
    if (paymentMethod === "💵 Efectivo") {
      const isExact = Math.random() < 0.3;
      if (isExact) {
        pagoDetalle = "Pago exacto";
      } else {
        // Redondear total a la siguiente denominación
        const roundedUp = Math.ceil(total / 1000) * 1000;
        const extraBill = roundedUp + (Math.random() < 0.5 ? 5000 : 0);
        pagoDetalle = `Paga con: $${extraBill.toLocaleString('es-AR')} (Vuelto: $${(extraBill - total).toLocaleString('es-AR')})`;
      }
    }

    const notePool = [
      "Tocar fuerte el timbre",
      "Llamar por teléfono al llegar",
      "Dejar en portería",
      "Enviar vuelto en billetes grandes",
      "Que no esté muy congelado por favor",
      "", "", "", "" // Mayoría vacíos
    ];
    const notes = notePool[Math.floor(Math.random() * notePool.length)];

    list.push({
      orderId: orderId,
      timestamp: orderDate.toISOString(),
      nombre: name,
      tel: phone,
      deliveryMode: deliveryMode,
      direccion: address,
      paymentMethod: paymentMethod,
      detalle: itemsLines.join("\n"),
      total: total,
      pagoDetalle: pagoDetalle,
      notes: notes,
      estado: status
    });
  }
  
  return list;
}

// ─── REPORTES Y VISTA GENERAL (KPI & GRAFICOS) ───────────────────────

// Analiza las líneas de detalle de un pedido y retorna un arreglo estructurado de ítems con cantidades e ingresos calculados
function parseOrderItems(detalleString) {
  const items = [];
  if (!detalleString) return items;
  
  const lines = detalleString.split('\n');
  const sortedMenu = [...MENU].sort((a, b) => b.name.length - a.name.length);
  
  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;
    
    // Obtener cantidad
    const qtyMatch = cleanLine.match(/^(\d+)\s*x/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    
    // Buscar coincidencia del producto
    const match = sortedMenu.find(p => cleanLine.toLowerCase().includes(p.name.toLowerCase()));
    if (match) {
      // Calcular precio unitario según la opción
      let price = match.price;
      if (cleanLine.includes("500g") && match.priceHalf) {
        price = match.priceHalf;
      } else if (cleanLine.includes("Unidad") && match.priceUnit) {
        price = match.priceUnit;
      }
      
      items.push({
        product: match,
        qty: qty,
        unitPrice: price,
        subtotal: price * qty
      });
    }
  });
  
  return items;
}

function updateDashboardMetrics() {
  const validOrders = allOrders.filter(o => o.estado !== "Cancelado");
  const totalOrders = validOrders.length;
  
  // 1. Facturado
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  document.getElementById("kpi-revenue").textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
  
  // 2. Pedidos Totales
  document.getElementById("kpi-orders").textContent = allOrders.length;
  
  // 3. Ticket Promedio
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  document.getElementById("kpi-aov").textContent = `$${aov.toLocaleString('es-AR')}`;
  
  // 4. Delivery %
  const deliveryCount = validOrders.filter(o => o.deliveryMode.includes("Delivery")).length;
  const deliveryPct = totalOrders > 0 ? Math.round((deliveryCount / totalOrders) * 100) : 0;
  document.getElementById("kpi-delivery").textContent = `${deliveryPct}%`;
  
  // Renglones de tendencias dinámicas basadas en simulación/datos
  document.getElementById("kpi-revenue-trend").textContent = `Facturación promedio de $${(aov).toLocaleString('es-AR')} por venta`;
  document.getElementById("kpi-orders-trend").textContent = `Con ${allOrders.filter(o => o.estado === "Pendiente").length} pendientes en cocina`;
  document.getElementById("kpi-delivery-trend").textContent = `${deliveryCount} envíos 🛵 · ${totalOrders - deliveryCount} retiros 🏃`;

  // Renderizar gráficos del dashboard
  renderOverviewCharts();
  
  // Renderizar estrella, analíticas avanzadas y vistas recientes
  renderStarProducts();
  renderInsights();
  updateAdvancedAnalytics();
  renderRecentOrdersPreview();
}

function renderOverviewCharts() {
  const validOrders = allOrders.filter(o => o.estado !== "Cancelado");
  
  // ─── 1. EVOLUCIÓN DE VENTAS (ÚLTIMOS 30 DÍAS) ───
  // Agrupar ventas por día
  const dailySales = {};
  
  // Rellenar últimos 30 días con ceros para tener una serie continua limpia
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    dailySales[dateStr] = 0;
  }

  validOrders.forEach(o => {
    const date = new Date(o.timestamp);
    const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
    if (dailySales[dateStr] !== undefined) {
      dailySales[dateStr] += o.total;
    }
  });

  const salesLabels = Object.keys(dailySales);
  const salesData = Object.values(dailySales);

  if (salesChartInstance) salesChartInstance.destroy();
  
  const ctxSales = document.getElementById("salesChart").getContext("2d");
  
  // Degradado celeste
  const gradient = ctxSales.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(0, 164, 228, 0.4)');
  gradient.addColorStop(1, 'rgba(0, 164, 228, 0.02)');

  salesChartInstance = new Chart(ctxSales, {
    type: 'line',
    data: {
      labels: salesLabels,
      datasets: [{
        label: 'Ventas Diarias',
        data: salesData,
        borderColor: '#00A4E4',
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#003a70',
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { callback: value => '$' + value.toLocaleString('es-AR') }
        },
        x: { grid: { display: false } }
      }
    }
  });

  // ─── 2. CATEGORÍAS MÁS VENDIDAS (Breakdown por total $) ───
  const catSales = {
    'Rebozados Pollo 🍗': 0,
    'Granja & Cortes 🐔': 0,
    'Mar y Río 🐟': 0,
    'Veggie & Soja 🌿': 0,
    'Bocados & Papas 🍟': 0,
    'Almacén 🥚': 0
  };

  validOrders.forEach(o => {
    const items = parseOrderItems(o.detalle);
    items.forEach(item => {
      let catLabel = 'Almacén 🥚';
      if (item.product.cat === 'pollo-rebozado') catLabel = 'Rebozados Pollo 🍗';
      else if (item.product.cat === 'pollo-granja') catLabel = 'Granja & Cortes 🐔';
      else if (item.product.cat === 'pescados-mariscos') catLabel = 'Mar y Río 🐟';
      else if (item.product.cat === 'veggie-soja') catLabel = 'Veggie & Soja 🌿';
      else if (item.product.cat === 'bocados-papas') catLabel = 'Bocados & Papas 🍟';
      
      catSales[catLabel] += item.subtotal;
    });
  });

  const catLabels = Object.keys(catSales);
  const catData = Object.values(catSales);

  if (categoriesChartInstance) categoriesChartInstance.destroy();
  const ctxCats = document.getElementById("categoriesChart").getContext("2d");
  categoriesChartInstance = new Chart(ctxCats, {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catData,
        backgroundColor: ['#00A4E4', '#003a70', '#002244', '#25D366', '#FFB81C', '#94a3b8'],
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { weight: 700 } } }
      }
    }
  });

  // ─── 3. HORAS PICO DE PEDIDOS ───
  const hoursData = Array(24).fill(0);
  validOrders.forEach(o => {
    const hr = new Date(o.timestamp).getHours();
    hoursData[hr]++;
  });

  if (hoursChartInstance) hoursChartInstance.destroy();
  const ctxHours = document.getElementById("hoursChart").getContext("2d");
  hoursChartInstance = new Chart(ctxHours, {
    type: 'line',
    data: {
      labels: Array.from({length: 24}, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Cantidad de Pedidos',
        data: hoursData,
        borderColor: '#FFB81C',
        backgroundColor: 'rgba(255, 184, 28, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // ─── 4. PEDIDOS POR DIA DE LA SEMANA ───
  const weekdayCounts = { 'Dom': 0, 'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0 };
  const wdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  validOrders.forEach(o => {
    const dayIdx = new Date(o.timestamp).getDay();
    weekdayCounts[wdays[dayIdx]]++;
  });

  if (weekdaysChartInstance) weekdaysChartInstance.destroy();
  const ctxWeekdays = document.getElementById("weekdaysChart").getContext("2d");
  weekdaysChartInstance = new Chart(ctxWeekdays, {
    type: 'bar',
    data: {
      labels: Object.keys(weekdayCounts),
      datasets: [{
        label: 'Pedidos',
        data: Object.values(weekdayCounts),
        backgroundColor: '#003a70',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });

  // ─── 5. DISTRIBUCION DE METODOS DE PAGO ───
  const payCounts = { 'Efectivo': 0, 'Transferencia': 0 };
  validOrders.forEach(o => {
    if (o.paymentMethod.includes("Efectivo")) payCounts['Efectivo']++;
    else payCounts['Transferencia']++;
  });

  if (paymentsChartInstance) paymentsChartInstance.destroy();
  const ctxPayments = document.getElementById("paymentsChart").getContext("2d");
  paymentsChartInstance = new Chart(ctxPayments, {
    type: 'pie',
    data: {
      labels: Object.keys(payCounts),
      datasets: [{
        data: Object.values(payCounts),
        backgroundColor: ['#25D366', '#00A4E4'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  // ─── 6. RESUMEN GEOGRÁFICO / ZONAS ───
  const zones = {};
  validOrders.forEach(o => {
    if (o.deliveryMode.includes("Retiro")) {
      zones['Retiro en Local'] = (zones['Retiro en Local'] || 0) + 1;
    } else {
      const matchYB = o.direccion.toLowerCase().includes("yerba");
      const label = matchYB ? 'Yerba Buena' : 'S. M. de Tucumán (Barrio Norte/Centro)';
      zones[label] = (zones[label] || 0) + 1;
    }
  });

  if (zonesChartInstance) zonesChartInstance.destroy();
  const ctxZones = document.getElementById("zonesChart").getContext("2d");
  zonesChartInstance = new Chart(ctxZones, {
    type: 'bar',
    data: {
      labels: Object.keys(zones),
      datasets: [{
        data: Object.values(zones),
        backgroundColor: ['#00A4E4', '#FFB81C', '#003a70'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // Tabla horizontal
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function renderInsights() {
  const container = document.getElementById("insightsContent");
  if (!container) return;
  
  const validOrders = allOrders.filter(o => o.estado !== "Cancelado");
  
  // 1. Día con más pedidos
  const weekdayCounts = { 'Domingo': 0, 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0 };
  const wdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  validOrders.forEach(o => {
    const dayIdx = new Date(o.timestamp).getDay();
    weekdayCounts[wdays[dayIdx]]++;
  });
  const bestDay = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0];
  
  // 2. Hora pico
  const hoursData = Array(24).fill(0);
  validOrders.forEach(o => {
    const hr = new Date(o.timestamp).getHours();
    hoursData[hr]++;
  });
  const peakHour = hoursData.indexOf(Math.max(...hoursData));
  
  // 3. Producto más vendido
  const countMap = {};
  validOrders.forEach(o => {
    const items = parseOrderItems(o.detalle);
    items.forEach(item => {
      if (!countMap[item.product.id]) {
        countMap[item.product.id] = { product: item.product, count: 0, revenue: 0 };
      }
      countMap[item.product.id].count += item.qty;
      countMap[item.product.id].revenue += item.subtotal;
    });
  });
  const topProduct = Object.values(countMap).sort((a, b) => b.count - a.count)[0];
  
  // 4. Pedidos activos (no entregados ni cancelados)
  const activeOrders = validOrders.filter(o => o.estado !== "Entregado" && o.estado !== "Cancelado").length;
  
  container.innerHTML = `
    <div class="insight-item">
      <div style="font-size:28px; margin-bottom:4px;">📅</div>
      <div style="font-size:13px; color:var(--text-light); font-weight:600;">Día con más pedidos</div>
      <div style="font-size:18px; font-weight:800; color:var(--brand2);">${bestDay ? `${bestDay[0]} (${bestDay[1]})` : 'Sin datos'}</div>
    </div>
    <div class="insight-item">
      <div style="font-size:28px; margin-bottom:4px;">🕐</div>
      <div style="font-size:13px; color:var(--text-light); font-weight:600;">Hora pico de pedidos</div>
      <div style="font-size:18px; font-weight:800; color:var(--brand2);">${peakHour !== undefined ? `${peakHour}:00 - ${peakHour + 1}:00 hs` : 'Sin datos'}</div>
    </div>
    <div class="insight-item">
      <div style="font-size:28px; margin-bottom:4px;">🏆</div>
      <div style="font-size:13px; color:var(--text-light); font-weight:600;">Producto estrella</div>
      <div style="font-size:18px; font-weight:800; color:var(--brand2);">${topProduct ? `${topProduct.product.emoji} ${topProduct.product.name} (${topProduct.count} unid.)` : 'Sin datos'}</div>
    </div>
    <div class="insight-item">
      <div style="font-size:28px; margin-bottom:4px;">👨‍🍳</div>
      <div style="font-size:13px; color:var(--text-light); font-weight:600;">Pedidos activos en cocina</div>
      <div style="font-size:18px; font-weight:800; color:var(--brand2);">${activeOrders} pendientes</div>
    </div>
  `;
}

function renderStarProducts() {
  const validOrders = allOrders.filter(o => o.estado !== "Cancelado");
  const countMap = {};

  validOrders.forEach(o => {
    const items = parseOrderItems(o.detalle);
    items.forEach(item => {
      if (!countMap[item.product.id]) {
        countMap[item.product.id] = { product: item.product, count: 0, revenue: 0 };
      }
      countMap[item.product.id].count += item.qty;
      countMap[item.product.id].revenue += item.subtotal;
    });
  });

  // Ordenar de mayor a menor cantidad vendida
  const sorted = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 5);

  const container = document.getElementById("topProductsList");
  container.innerHTML = "";

  if (sorted.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--text-light)">Aún no hay ventas registradas.</div>`;
    return;
  }

  sorted.forEach(item => {
    const categoryLabels = {
      'pollo-rebozado': 'Rebozados Pollo',
      'pollo-granja': 'Granja & Cortes',
      'pescados-mariscos': 'Mar y Río',
      'veggie-soja': 'Veggie & Soja',
      'bocados-papas': 'Bocados & Papas',
      'almacen-huevos': 'Almacén'
    };

    container.innerHTML += `
      <div class="top-product-item">
        <div class="prod-details">
          <div class="prod-emoji">${item.product.emoji}</div>
          <div>
            <div class="prod-name">${item.product.name}</div>
            <div class="prod-category">${categoryLabels[item.product.cat] || 'Menú'}</div>
          </div>
        </div>
        <div class="prod-stats">
          <div class="prod-sales">${item.count} unid.</div>
          <div class="prod-revenue">$${item.revenue.toLocaleString('es-AR')}</div>
        </div>
      </div>`;
  });
}

function updateAdvancedAnalytics() {
  const validOrders = allOrders.filter(o => o.estado !== "Cancelado");
  
  // ─── 1. ANÁLISIS DE CLIENTES ───
  const customersMap = {};
  
  validOrders.forEach(o => {
    const rawPhone = o.tel.toString().trim();
    const phone = normalizePhone(rawPhone);
    if (!phone || phone === "--" || phone === "") return;
    
    if (!customersMap[phone]) {
      customersMap[phone] = {
        name: o.nombre,
        phone: rawPhone,
        phoneNorm: phone,
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: o.timestamp
      };
    }
    
    customersMap[phone].orderCount += 1;
    customersMap[phone].totalSpent += o.total;
    if (new Date(o.timestamp) > new Date(customersMap[phone].lastOrderDate)) {
      customersMap[phone].lastOrderDate = o.timestamp;
      customersMap[phone].name = o.nombre;
    }
  });

  const customerList = Object.values(customersMap);
  const uniqueClientsCount = customerList.length;
  const repeatClientsCount = customerList.filter(c => c.orderCount > 1).length;
  const recurrenceRate = uniqueClientsCount > 0 ? Math.round((repeatClientsCount / uniqueClientsCount) * 100) : 0;

  // Actualizar KPIs en el DOM
  document.getElementById("kpi-unique-clients").textContent = uniqueClientsCount;
  document.getElementById("kpi-repeat-clients").textContent = repeatClientsCount;
  document.getElementById("kpi-recurrence-rate").textContent = `${recurrenceRate}%`;
  
  const repeatTrendEl = document.getElementById("kpi-repeat-trend");
  const recurrenceTrendEl = document.getElementById("kpi-recurrence-trend");
  if (repeatTrendEl) repeatTrendEl.textContent = `${repeatClientsCount} de ${uniqueClientsCount} clientes volvieron`;
  if (recurrenceTrendEl) recurrenceTrendEl.textContent = uniqueClientsCount > 0 ? `Excelente tasa de fidelización` : "Sin datos de clientes";

  // Renderizar Ranking de Clientes Fieles (LTV)
  const topClients = [...customerList].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
  const topClientsBody = document.getElementById("topClientsTableBody");
  
  if (topClientsBody) {
    topClientsBody.innerHTML = "";
    if (topClients.length === 0) {
      topClientsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-light)">Aún no hay clientes registrados.</td></tr>`;
    } else {
      topClients.forEach(c => {
        topClientsBody.innerHTML += `
          <tr>
            <td style="font-weight: 700; padding: 12px 14px;">👤 ${c.name}</td>
            <td style="color: var(--text-light); padding: 12px 14px; font-family: monospace;">${c.phone}</td>
            <td style="text-align: center; font-weight: 700; padding: 12px 14px;">${c.orderCount}</td>
            <td style="text-align: right; font-weight: 800; color: var(--brand); padding: 12px 14px;">$${c.totalSpent.toLocaleString('es-AR')}</td>
          </tr>`;
      });
    }
  }

  // ─── 2. ANÁLISIS DE PRODUCTOS COMPLETO ───
  const productsMap = {};
  let totalItemsSold = 0;

  validOrders.forEach(o => {
    const items = parseOrderItems(o.detalle);
    items.forEach(item => {
      const pid = item.product.id;
      if (!productsMap[pid]) {
        productsMap[pid] = {
          product: item.product,
          unitsSold: 0,
          revenue: 0
        };
      }
      productsMap[pid].unitsSold += item.qty;
      productsMap[pid].revenue += item.subtotal;
      totalItemsSold += item.qty;
    });
  });

  // KPI Promedio de ítems por pedido
  const avgItemsPerOrder = validOrders.length > 0 ? (totalItemsSold / validOrders.length).toFixed(1) : 0;
  document.getElementById("kpi-avg-items").textContent = avgItemsPerOrder;
  
  const itemsTrendEl = document.getElementById("kpi-items-trend");
  if (itemsTrendEl) itemsTrendEl.textContent = `Total de ${totalItemsSold} unidades vendidas en cocina`;

  // Renderizar tabla de rendimiento por producto
  const productPerformanceList = Object.values(productsMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 8);
  const prodPerfBody = document.getElementById("productPerformanceTableBody");

  if (prodPerfBody) {
    prodPerfBody.innerHTML = "";
    if (productPerformanceList.length === 0) {
      prodPerfBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:var(--text-light)">Aún no hay productos vendidos.</td></tr>`;
    } else {
      productPerformanceList.forEach(p => {
        const pctShare = totalItemsSold > 0 ? ((p.unitsSold / totalItemsSold) * 100).toFixed(1) : 0;
        prodPerfBody.innerHTML += `
          <tr>
            <td style="font-weight: 700; padding: 12px 14px;">
              <span style="font-size: 16px; margin-right: 4px;">${p.product.emoji}</span> ${p.product.name}
            </td>
            <td style="text-align: center; font-weight: 700; padding: 12px 14px;">${p.unitsSold} u.</td>
            <td style="text-align: right; font-weight: 800; color: #16a34a; padding: 12px 14px;">$${p.revenue.toLocaleString('es-AR')}</td>
            <td style="text-align: center; padding: 12px 14px;">
              <span style="font-size: 12px; background: var(--bg); padding: 3px 6px; border-radius: 6px; font-weight: 700; color: var(--text-light);">${pctShare}%</span>
            </td>
          </tr>`;
      });
    }
  }
}

function renderRecentOrdersPreview() {
  const previewBody = document.getElementById("recentOrdersPreviewBody");
  previewBody.innerHTML = "";

  const recent = allOrders.slice(0, 5);

  if (recent.length === 0) {
    previewBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">Sin pedidos.</td></tr>`;
    return;
  }

  recent.forEach(o => {
    let statusClass = o.estado.toLowerCase().replace(" ", "-").replace("ó", "o");
    
    previewBody.innerHTML += `
      <tr onclick="openOrderModal('${o.orderId}')" style="cursor:pointer">
        <td><span class="order-id-badge">${o.orderId}</span></td>
        <td>${o.nombre.split(' ')[0]}</td>
        <td style="font-weight: 700; color:var(--brand)">$${o.total.toLocaleString('es-AR')}</td>
        <td><span class="status-badge ${statusClass}">${o.estado}</span></td>
      </tr>`;
  });
}

// ─── CONTROLADOR DE VISTAS (PÁGINAS) ──────────────────────────────────
function switchView(viewName) {
  playPopSound();
  
  // Desactivar vista anterior
  document.getElementById(`view-${activeView}`).classList.remove("active");
  document.getElementById(`nav-${activeView}`).classList.remove("active");
  
  // Activar vista nueva
  document.getElementById(`view-${viewName}`).classList.add("active");
  document.getElementById(`nav-${viewName}`).classList.add("active");
  
  activeView = viewName;

  // Cambiar título superior de la página
  const titles = {
    overview: 'Vista General',
    orders: 'Pedidos & CRM',
    reports: 'Informes & Estadísticas',
    catalog: 'Catálogo de Control'
  };
  document.getElementById("pageTitle").textContent = titles[viewName] || 'Panel';

  // Si volvemos a Vista General o Reportes, refrescar gráficos
  if (viewName === 'overview' || viewName === 'reports') {
    renderOverviewCharts();
  }
}

// ─── FILTROS Y PAGINACIÓN DE PEDIDOS ─────────────────────────────────
function setStatusFilter(status) {
  playPopSound();
  activeStatusFilter = status;
  
  // Actualizar clases activas en los botones de tabs
  const tabs = document.querySelectorAll("#statusTabsContainer .status-tab");
  tabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.status === status);
  });
  
  currentPage = 1;
  filterData();
}

function filterData() {
  const searchQ = document.getElementById("orderSearchInput").value.toLowerCase().trim();
  const deliveryF = document.getElementById("deliveryFilter").value;
  const paymentF = document.getElementById("paymentFilter").value;
  const dateFrom = document.getElementById("dateFromFilter")?.value;
  const dateTo = document.getElementById("dateToFilter")?.value;

  let fromDate = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
  let toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;

  filteredOrders = allOrders.filter(o => {
    // 1. Filtro por Estado
    if (activeStatusFilter !== 'todos' && o.estado !== activeStatusFilter) return false;
    
    // 2. Filtro por Modalidad (Delivery vs Retiro)
    if (deliveryF === 'delivery' && !o.deliveryMode.includes("Delivery")) return false;
    if (deliveryF === 'takeaway' && !o.deliveryMode.includes("Retiro")) return false;
    
    // 3. Filtro por Método de Pago
    if (paymentF === 'efectivo' && !o.paymentMethod.includes("Efectivo")) return false;
    if (paymentF === 'transferencia' && !o.paymentMethod.includes("Transferencia")) return false;
    
    // 4. Filtro por Rango de Fechas
    if (fromDate || toDate) {
      const orderDate = new Date(o.timestamp);
      if (fromDate && orderDate < fromDate) return false;
      if (toDate && orderDate > toDate) return false;
    }
    
    // 5. Filtro por Buscador
    if (searchQ) {
      const matchSearch = 
        o.orderId.toLowerCase().includes(searchQ) ||
        o.nombre.toLowerCase().includes(searchQ) ||
        o.tel.toLowerCase().includes(searchQ) ||
        o.direccion.toLowerCase().includes(searchQ) ||
        o.detalle.toLowerCase().includes(searchQ);
      if (!matchSearch) return false;
    }
    
    return true;
  });

  renderOrdersTable();
}

function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = "";

  const totalRecords = filteredOrders.length;
  
  if (totalRecords === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color:var(--text-light); font-weight:700">Ningún pedido coincide con los filtros aplicados.</td></tr>`;
    document.getElementById("paginationInfo").textContent = "Mostrando 0-0 de 0 pedidos";
    document.getElementById("prevPageBtn").disabled = true;
    document.getElementById("nextPageBtn").disabled = true;
    return;
  }

  // Calcular límites de página
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  currentPage = Math.min(currentPage, totalPages);
  
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = Math.min(startIndex + recordsPerPage, totalRecords);
  
  const paginatedList = filteredOrders.slice(startIndex, endIndex);

  paginatedList.forEach(o => {
    let statusClass = o.estado.toLowerCase().replace(" ", "-").replace("ó", "o");
    
    // Formatear fecha
    const dateObj = new Date(o.timestamp);
    const dateText = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + 
                     dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + 'hs';
    
    tbody.innerHTML += `
      <tr>
        <td><span class="order-id-badge">${o.orderId}</span></td>
        <td style="font-size: 13.5px; color: var(--text-light);">${dateText}</td>
        <td>
          <div style="font-weight: 700;">${o.nombre}</div>
          <div style="font-size: 12.5px; color:var(--text-light); font-weight:500;">📞 ${o.tel}</div>
        </td>
        <td>
          <div style="font-size:14px;">${o.deliveryMode.includes("Delivery") ? '🛵 Domicilio' : '🏃 Retiro Local'}</div>
          <div style="font-size: 11.5px; color:var(--text-light); font-weight:500; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${o.direccion}">${o.direccion}</div>
        </td>
        <td style="font-size: 14px;">${o.paymentMethod.includes("Efectivo") ? '💵 Efectivo' : '📱 Transf.'}</td>
        <td style="font-weight: 800; color: var(--brand);">$${o.total.toLocaleString('es-AR')}</td>
        <td><span class="status-badge ${statusClass}">${o.estado}</span></td>
        <td style="text-align: center;">
          <button class="action-cell-btn" onclick="openOrderModal('${o.orderId}')">🔎 Detalles</button>
        </td>
      </tr>`;
  });

  // Actualizar UI paginación
  document.getElementById("paginationInfo").textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${totalRecords} pedidos`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = currentPage === totalPages;
}

function changePage(delta) {
  playPopSound();
  currentPage += delta;
  renderOrdersTable();
}

// ─── MODAL DETALLE DE ORDEN (TICKET) ──────────────────────────────────
function openOrderModal(orderId) {
  playPopSound();
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;
  
  selectedOrder = order;
  
  document.getElementById("ticketOrderId").textContent = order.orderId;
  document.getElementById("ticketBarcodeText").textContent = order.orderId;
  
  const dateObj = new Date(order.timestamp);
  const dateText = dateObj.toLocaleDateString('es-AR') + ' ' + dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + 'hs';
  document.getElementById("ticketDate").textContent = dateText;
  
  document.getElementById("ticketCustomer").textContent = order.nombre;
  document.getElementById("ticketPhone").textContent = order.tel;
  document.getElementById("ticketMode").textContent = order.deliveryMode;
  document.getElementById("ticketAddress").textContent = order.direccion;
  
  // Método de pago formateado
  let paymentText = order.paymentMethod;
  if (order.pagoDetalle && order.pagoDetalle !== "N/A") {
    paymentText += ` (${order.pagoDetalle})`;
  }
  document.getElementById("ticketPayment").textContent = paymentText;
  
  // Renderizar filas de ítems del ticket
  const itemsContainer = document.getElementById("ticketItems");
  itemsContainer.innerHTML = "";
  
  const lines = order.detalle.split("\n");
  lines.forEach(line => {
    if (!line.trim()) return;
    const parts = line.split("—");
    const namePart = parts[0] || "";
    const pricePart = parts[1] || "";
    
    itemsContainer.innerHTML += `
      <div class="receipt-item-row">
        <span class="receipt-item-name">${namePart}</span>
        <span>${pricePart}</span>
      </div>`;
  });
  
  document.getElementById("ticketSubtotal").textContent = `$${order.total.toLocaleString('es-AR')}`;
  document.getElementById("ticketTotal").textContent = `$${order.total.toLocaleString('es-AR')}`;
  document.getElementById("ticketNotes").textContent = order.notes ? order.notes : "Sin aclaraciones adicionales.";

  // Resaltar el botón del estado actual del pedido desactivando su opacidad o agregando un borde
  updateModalStatusButtons(order.estado);

  // Poblar el selector de productos para edición
  populateEditProductSelect();

  // Resetear modo edición
  isEditMode = false;
  editOrderRef = null;
  editingItems = [];
  document.getElementById("orderEditPanel").style.display = 'none';
  const editBtn = document.getElementById("editOrderToggleBtn");
  if (editBtn) {
    editBtn.textContent = '✏️ Editar Contenido del Pedido';
    editBtn.className = 'modal-action-btn btn-edit';
  }

  // Abrir Modal
  document.getElementById("orderModalOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function populateEditProductSelect() {
  const select = document.getElementById("editProductSelect");
  select.innerHTML = '<option value="">🔽 Agregar producto al pedido...</option>';
  MENU.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.emoji} ${p.name} - $${p.price.toLocaleString('es-AR')}`;
    select.appendChild(opt);
  });
}

function updateModalStatusButtons(currentStatus) {
  // Desactivar botones de estado no elegibles si el pedido ya está cancelado o entregado
  const btns = document.querySelectorAll("#statusBtnContainer .modal-action-btn");
  btns.forEach(btn => {
    // Restaurar estilos base
    btn.style.boxShadow = "none";
    btn.style.border = "none";
  });

  const btnMap = {
    'En Preparación': document.querySelector(".btn-prep"),
    'Enviado': document.querySelector(".btn-send"),
    'Entregado': document.querySelector(".btn-done"),
    'Cancelado': document.querySelector(".btn-cancel")
  };
  
  const activeBtn = btnMap[currentStatus];
  if (activeBtn) {
    activeBtn.style.border = "3.5px solid var(--gold)";
    activeBtn.style.boxShadow = "0 0 15px rgba(255, 184, 28, 0.4)";
  }
}

function closeOrderModal() {
  playPopSound();
  // Si estábamos en modo edición, cancelar
  if (isEditMode) {
    cancelOrderEdit();
  }
  document.getElementById("orderModalOverlay").classList.remove("open");
  document.body.style.overflow = "";
  selectedOrder = null;
  editOrderRef = null;
}

async function updateStatus(newState) {
  if (!selectedOrder) return;
  playPopSound();

  const prevStatus = selectedOrder.estado;
  const orderId = selectedOrder.orderId;
  
  // Desactivar temporalmente los botones para evitar doble clic
  const btns = document.querySelectorAll("#statusBtnContainer .modal-action-btn");
  btns.forEach(btn => btn.disabled = true);

  try {
    showToast("💾 Guardando cambio de estado...", "⏳");

    if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== "" && !GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar")) {
      const payload = {
        action: 'updateState',
        orderId: orderId,
        newState: newState
      };
      
      const response = await Promise.race([
        fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: JSON.stringify(payload)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de red')), 3500))
      ]);
      
      const result = await response.json();
      if (result && result.status === 'success') {
        updateLocalState(orderId, newState);
        showToast(`Pedido ${orderId} actualizado a "${newState}" en la planilla`, "🟢");
      } else {
        throw new Error("Respuesta de error de la planilla");
      }
    } else {
      throw new Error("Planilla no conectada en vivo");
    }
  } catch (error) {
    console.warn("No se pudo escribir en el servidor remetodo. Aplicando cambio localmente:", error.message);
    
    // Cambiar estado en memoria
    updateLocalState(orderId, newState);
    showToast(`Estado cambiado a "${newState}" (Simulado localmente)`, "💾");
  } finally {
    btns.forEach(btn => btn.disabled = false);
    closeOrderModal();
  }
}

function updateLocalState(orderId, newState) {
  // Actualizar estado en el arreglo en memoria
  const idx = allOrders.findIndex(o => o.orderId === orderId);
  if (idx !== -1) {
    allOrders[idx].estado = newState;
    
    // Guardar base de datos simulada actualizada en localStorage
    localStorage.setItem("p25_orders_db", JSON.stringify(allOrders));
  }
  
  // Refrescar vistas
  filterData();
  updateDashboardMetrics();
}

// ─── GESTIÓN DE STOCK Y ESTADO DE PRODUCTOS ────────────────────────────

async function toggleProductStock(productId) {
  playPopSound();
  const p = MENU.find(x => x.id === productId);
  if (!p) return;
  
  p.enabled = !p.enabled;
  renderCatalog(); // Optimistic UI update
  const label = p.enabled ? 'habilitado' : 'deshabilitado (sin stock)';
  showToast(`${p.name} ${label}`, p.enabled ? '🟢' : '🔴');
  
  try {
    if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== "" && !GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar")) {
      const payload = {
        action: 'toggleProductStock',
        id: productId,
        enabled: p.enabled
      };
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      // Optionally update cache
      localStorage.setItem("p25_catalog_db", JSON.stringify(MENU));
    }
  } catch(e) {
    console.error("Error al sincronizar stock:", e);
    showToast("Error al guardar en base de datos. Se revirtió el cambio.", "❌");
    p.enabled = !p.enabled; // Revert
    renderCatalog();
  }
}

// ─── VISUALIZADOR DE CATÁLOGO ───
function renderCatalog() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const stockFilter = document.getElementById('stockFilter')?.value || 'todos';
  
  // Estadísticas de stock
  const totalProducts = MENU.length;
  const enabledCount = MENU.filter(p => p.enabled !== false).length;
  const disabledCount = totalProducts - enabledCount;
  
  // Mostrar resumen de stock
  const stockSummary = document.getElementById("stockSummary");
  if (stockSummary) {
    stockSummary.innerHTML = `
      <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
        <span style="font-weight:700; color:var(--text);">📊 Resumen de Stock:</span>
        <span style="color:#16a34a; font-weight:700;">🟢 ${enabledCount} habilitados</span>
        <span style="color:var(--red); font-weight:700;">🔴 ${disabledCount} deshabilitados</span>
        <span style="color:var(--text-light); font-weight:600;">📦 ${totalProducts} productos totales</span>
        <button onclick="openProductModal()" class="action-cell-btn" style="background:var(--brand); color:white; margin-left:auto;">➕ Nuevo Producto</button>
      </div>`;
  }
  
  MENU.forEach(p => {
    const isEnabled = p.enabled !== false;
    
    // Aplicar filtro de stock
    if (stockFilter === 'enabled' && !isEnabled) return;
    if (stockFilter === 'disabled' && isEnabled) return;
    
    let unitSuffix = "Unidad";
    let suffixHTML = `x ${unitSuffix}`;
    if (p.unitType === "peso") {
      unitSuffix = "Kilo";
      suffixHTML = `x ${unitSuffix}`;
    }
    else if (p.unitType === "mixto") {
      unitSuffix = "Kilo / Unidad";
      suffixHTML = `x ${unitSuffix}`;
    }
    else if (p.cat === "almacen-huevos" && p.id === 46) {
      unitSuffix = "Bandeja";
      suffixHTML = `x ${unitSuffix}`;
    }

    const stockClass = isEnabled ? 'stock-ok' : 'stock-out';
    const stockLabel = isEnabled ? '🟢 Disponible' : '🔴 Sin Stock';
    const toggleLabel = isEnabled ? '🔒 Deshabilitar' : '🔓 Habilitar';

    grid.innerHTML += `
      <div class="catalog-card ${stockClass}" data-cat="${p.cat}" data-name="${p.name.toLowerCase()}">
        <div>
          <div class="cat-head">
            <div class="cat-emoji-wrap">${p.emoji}</div>
            <div class="cat-badge-pill">${p.cat.replace("-", " ")}</div>
          </div>
          
          <div class="cat-body">
            <h4 class="cat-title-name">${p.name}</h4>
            <p class="cat-desc-text">${p.desc}</p>
          </div>
        </div>
        
        <div class="cat-foot">
          <div class="cat-price-val">$${p.price.toLocaleString('es-AR')} <span style="font-size:11.5px; font-weight:600; color:var(--text-light)">${suffixHTML}</span></div>
          <div>
            <div class="cat-rating">⭐ ${p.rating ? p.rating.toFixed(1) : '4.8'}</div>
            <div class="cat-stock-indicator ${stockClass}" onclick="toggleProductStock(${p.id})" title="Habilitar/Deshabilitar producto">${stockLabel}</div>
          </div>
        </div>
        <div style="margin-top:8px; border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:center; gap: 8px;">
          <button class="stock-toggle-btn" onclick="event.stopPropagation(); toggleProductStock(${p.id})">${toggleLabel}</button>
          <button class="stock-toggle-btn" style="background:#475569; color:white;" onclick="event.stopPropagation(); openProductModal(${p.id})">✏️ Editar</button>
          <button class="stock-toggle-btn" style="background:var(--red); color:white; width: 40px;" onclick="event.stopPropagation(); deleteProduct(${p.id})">🗑️</button>
        </div>
      </div>`;
  });
}

function filterCatalog() {
  const searchQ = document.getElementById("catalogSearchInput").value.toLowerCase().trim();
  const catFilter = document.getElementById("catalogCategoryFilter").value;
  
  // Re-render completo cuando cambia el filtro de stock para aplicar correctamente
  renderCatalog();
  
  const cards = document.querySelectorAll("#catalogGrid .catalog-card");
  cards.forEach(card => {
    const name = card.dataset.name;
    const cat = card.dataset.cat;
    
    const matchSearch = !searchQ || name.includes(searchQ);
    const matchCat = catFilter === 'todos' || cat === catFilter;
    
    if (matchSearch && matchCat) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

// ─── EDICIÓN DE CONTENIDO DE PEDIDOS ──────────────────────────────────
let editingItems = [];
let isEditMode = false;
let editOrderRef = null;

function toggleOrderEditMode() {
  playPopSound();
  const editPanel = document.getElementById("orderEditPanel");
  const editToggleBtn = document.getElementById("editOrderToggleBtn");
  
  isEditMode = !isEditMode;
  
  if (isEditMode) {
    // Inicializar items editables desde el detalle actual
    const items = parseOrderItems(selectedOrder.detalle);
    editingItems = items.map(item => ({
      product: item.product,
      qty: item.qty,
      option: getItemOption(item),
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    }));
    editOrderRef = selectedOrder;
    editToggleBtn.textContent = '↩️ Cancelar Edición';
    editToggleBtn.className = 'modal-action-btn btn-cancel';
    renderEditItems();
  } else {
    cancelOrderEdit();
  }
  
  editPanel.style.display = isEditMode ? 'block' : 'none';
}

function getItemOption(item) {
  if (item.product.unitType === 'peso') {
    return item.unitPrice === item.product.priceHalf ? '500g' : '1kg';
  } else if (item.product.unitType === 'mixto') {
    if (item.unitPrice === item.product.priceUnit) return 'Unidad';
    if (item.unitPrice === item.product.priceHalf) return '500g';
    return '1kg';
  }
  return null;
}

function renderEditItems() {
  const container = document.getElementById("editItemsContainer");
  container.innerHTML = "";
  
  if (editingItems.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-light);font-weight:600;">No hay productos en el pedido. Agregue productos abajo.</div>`;
    updateEditTotal();
    return;
  }
  
  editingItems.forEach((item, idx) => {
    const optionText = item.option ? ` (${item.option})` : '';
    container.innerHTML += `
      <div class="edit-item-row">
        <div class="edit-item-info">
          <span class="edit-item-emoji">${item.product.emoji}</span>
          <div>
            <div class="edit-item-name">${item.product.name}${optionText}</div>
            <div class="edit-item-price">$${item.unitPrice.toLocaleString('es-AR')} c/u</div>
          </div>
        </div>
        <div class="edit-item-controls">
          <button class="edit-qty-btn" onclick="changeEditItemQty(${idx}, -1)">−</button>
          <span class="edit-qty-val">${item.qty}</span>
          <button class="edit-qty-btn" onclick="changeEditItemQty(${idx}, 1)">+</button>
          <button class="edit-remove-btn" onclick="removeEditItem(${idx})">🗑️</button>
        </div>
      </div>`;
  });
  
  updateEditTotal();
}

function changeEditItemQty(idx, delta) {
  if (idx < 0 || idx >= editingItems.length) return;
  const newQty = editingItems[idx].qty + delta;
  if (newQty < 1) return;
  editingItems[idx].qty = newQty;
  editingItems[idx].subtotal = editingItems[idx].unitPrice * newQty;
  renderEditItems();
}

function removeEditItem(idx) {
  if (idx < 0 || idx >= editingItems.length) return;
  editingItems.splice(idx, 1);
  renderEditItems();
}

function addItemToOrder() {
  const select = document.getElementById("editProductSelect");
  const option = parseInt(select.value);
  if (!option) return;
  
  const product = MENU.find(p => p.id === option);
  if (!product) return;
  
  // Determinar precio y opción por defecto
  let unitPrice = product.price;
  let optText = null;
  
  if (product.unitType === 'peso') {
    unitPrice = product.price;
    optText = '1kg';
  } else if (product.unitType === 'mixto') {
    unitPrice = product.price;
    optText = '1kg';
  } else {
    unitPrice = product.price;
    optText = null;
  }
  
  // Verificar si ya existe para sumar cantidad
  const existing = editingItems.findIndex(
    item => item.product.id === product.id && item.option === optText
  );
  
  if (existing !== -1) {
    editingItems[existing].qty += 1;
    editingItems[existing].subtotal = editingItems[existing].unitPrice * editingItems[existing].qty;
  } else {
    editingItems.push({
      product: product,
      qty: 1,
      option: optText,
      unitPrice: unitPrice,
      subtotal: unitPrice
    });
  }
  
  select.value = "";
  renderEditItems();
  showToast(`${product.emoji} ${product.name} agregado al pedido`, '➕');
}

function updateEditTotal() {
  const total = editingItems.reduce((sum, item) => sum + item.subtotal, 0);
  document.getElementById("editTotalDisplay").textContent = `$${total.toLocaleString('es-AR')}`;
}

function rebuildOrderDetalle() {
  const lines = editingItems.map(item => {
    const optText = item.option ? ` (${item.option})` : '';
    const total = item.unitPrice * item.qty;
    return `${item.qty}x ${item.product.emoji} ${item.product.name}${optText} — $${total.toLocaleString('es-AR')}`;
  });
  return lines.join('\n');
}

function cancelOrderEdit() {
  isEditMode = false;
  editOrderRef = null;
  editingItems = [];
  document.getElementById("orderEditPanel").style.display = 'none';
  const btn = document.getElementById("editOrderToggleBtn");
  if (btn) {
    btn.textContent = '✏️ Editar Contenido del Pedido';
    btn.className = 'modal-action-btn btn-edit';
  }
}

async function saveOrderChanges() {
  if (!editOrderRef || editingItems.length === 0) {
    showToast('El pedido debe tener al menos un producto', '⚠️');
    return;
  }
  
  playPopSound();
  const newDetalle = rebuildOrderDetalle();
  const newTotal = editingItems.reduce((sum, item) => sum + item.subtotal, 0);
  const oldTotal = editOrderRef.total;
  
  // Agregar nota de modificación
  const modNote = `[MODIFICADO ${new Date().toLocaleString('es-AR')}] Se editó el contenido del pedido.`;
  const existingNotes = editOrderRef.notes && !editOrderRef.notes.includes('MODIFICADO') ? editOrderRef.notes : '';
  const newNotes = existingNotes ? `${existingNotes}\n${modNote}` : modNote;
  
  // Actualizar en memoria
  editOrderRef.detalle = newDetalle;
  editOrderRef.total = newTotal;
  editOrderRef.notes = newNotes;
  
  // Si el estado es "Entregado" o "Cancelado", lo revertimos a "En Preparación" para indicar cambio
  if (editOrderRef.estado === 'Entregado' || editOrderRef.estado === 'Cancelado') {
    editOrderRef.estado = 'En Preparación';
  }
  
  // Guardar en localStorage
  localStorage.setItem("p25_orders_db", JSON.stringify(allOrders));
  
  // Intentar sincronizar con Google Sheets
  try {
    if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== "" && !GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar")) {
      const payload = {
        action: 'updateOrder',
        orderId: editOrderRef.orderId,
        detalle: newDetalle,
        total: newTotal,
        notes: newNotes,
        estado: editOrderRef.estado
      };
      
      fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(r => r.json()).catch(() => {});
    }
  } catch (e) {}
  
  // Salir del modo edición y refrescar
  const savedId = editOrderRef.orderId;
  cancelOrderEdit();
  closeOrderModal();
  filterData();
  updateDashboardMetrics();
  showToast(`✅ Pedido ${savedId} modificado con éxito`, '✅');
}

// ─── EXPORTAR REPORTES A PDF / IMPRESIÓN ─────────────────────────────
function printReports() {
  playPopSound();
  
  // Cambiar temporalmente a vista reports para asegurar gráficos renderizados
  if (activeView !== 'reports') {
    switchView('reports');
  }
  
  // Esperar a que se rendericen los gráficos
  setTimeout(() => {
    window.print();
  }, 500);
}

// ─── TOAST NOTIFICATION PREMIUM ──────────────────────────────────────
let toastTimer = null;
function showToast(msg, icon = "💾") {
  const t = document.getElementById("toast");
  const tText = document.getElementById("toastText");
  const tIcon = document.getElementById("toastIcon");
  
  if (!t || !tText) return;
  
  tText.textContent = msg;
  tIcon.textContent = icon;
  t.classList.add("show");
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
}

// ─── MODO OSCURO (TEMA) ──────────────────────────────────────────────
function toggleTheme() {
  playPopSound();
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("p25_admin_theme", isDark ? "dark" : "light");
  
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
  
  showToast(isDark ? "Modo oscuro activado" : "Modo claro activado", isDark ? "🌙" : "☀️");
  
  // Re-dibujar gráficos para ajustar colores en modo oscuro si Chart.js está cargado
  setTimeout(renderOverviewCharts, 200);
}

function initTheme() {
  const saved = localStorage.getItem("p25_admin_theme");
  const btn = document.getElementById("themeToggleBtn");
  
  if (saved === "dark") {
    document.body.classList.add("dark");
    if (btn) btn.textContent = "☀️";
  } else if (saved === "light") {
    document.body.classList.remove("dark");
    if (btn) btn.textContent = "🌙";
  } else {
    // Activar modo noche automáticamente si es horario nocturno (19:30 a 07:00 hs)
    const hr = new Date().getHours();
    const isNight = hr >= 19 || hr < 7;
    if (isNight) {
      document.body.classList.add("dark");
      if (btn) btn.textContent = "☀️";
    }
  }
}

// --- PRODUCT CRUD ----------------------------------------------
function openProductModal(id = null) {
  playPopSound();
  const modal = document.getElementById('productModalOverlay');
  const title = document.getElementById('modalProductTitle');
  const form = document.getElementById('productForm');
  
  if (id) {
    const p = MENU.find(x => x.id === id);
    if (!p) return;
    title.textContent = 'Editar Producto';
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodCat').value = p.cat;
    document.getElementById('prodEmoji').value = p.emoji;
    document.getElementById('prodDesc').value = p.desc || '';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodUnitType').value = p.unitType;
    document.getElementById('prodImg').value = p.img || '';
  } else {
    title.textContent = 'Nuevo Producto';
    form.reset();
    document.getElementById('prodId').value = '';
  }
  
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  playPopSound();
  document.getElementById('productModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveProduct(e) {
  e.preventDefault();
  playPopSound();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  let id = document.getElementById('prodId').value;
  if (!id) {
    id = Date.now(); // Generate new ID
  } else {
    id = parseInt(id);
  }
  
  const isNew = !MENU.find(x => x.id === id);
  const p = {
    id: id,
    name: document.getElementById('prodName').value,
    cat: document.getElementById('prodCat').value,
    emoji: document.getElementById('prodEmoji').value,
    desc: document.getElementById('prodDesc').value,
    price: parseInt(document.getElementById('prodPrice').value),
    priceHalf: 0,
    unitType: document.getElementById('prodUnitType').value,
    img: document.getElementById('prodImg').value,
    enabled: true,
    rating: 4.8,
    hot: false,
    tags: []
  };
  
  if (p.unitType === 'peso' || p.unitType === 'mixto') {
    p.priceHalf = p.price / 2;
  }
  
  try {
    if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== "" && !GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar")) {
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify({ action: 'saveProduct', product: p })
      });
    }
    
    if (isNew) {
      MENU.push(p);
    } else {
      const idx = MENU.findIndex(x => x.id === id);
      if (idx !== -1) MENU[idx] = Object.assign(MENU[idx], p);
    }
    
    localStorage.setItem("p25_catalog_db", JSON.stringify(MENU));
    renderCatalog();
    closeProductModal();
    showToast("Producto guardado correctamente", "?");
  } catch (error) {
    console.error("Error al guardar:", error);
    showToast("Error al guardar producto", "?");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function deleteProduct(id) {
  playPopSound();
  if (!confirm("�Est�s seguro de que deseas eliminar este producto permanentemente?")) return;
  
  const idx = MENU.findIndex(x => x.id === id);
  if (idx === -1) return;
  
  try {
    if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== "" && !GOOGLE_SHEETS_URL.includes("macros/s/Reemplazar")) {
      await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: JSON.stringify({ action: 'deleteProduct', id: id })
      });
    }
    
    MENU.splice(idx, 1);
    localStorage.setItem("p25_catalog_db", JSON.stringify(MENU));
    renderCatalog();
    showToast("Producto eliminado", "???");
  } catch (error) {
    console.error("Error al eliminar:", error);
    showToast("Error al eliminar producto", "?");
  }
}

