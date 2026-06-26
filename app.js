// ─── STATE ───────────────────────────────────────────────────────
let cart = {};                  // Almacena: { "id-opcion": cantidad }
let selectedWeights = {};       // Almacena: { id: "1kg" o "0.5kg" }
let selectedWaIdx = 0;          // Índice del número de WhatsApp seleccionado (0 o 1)
let currentCat = 'todos';       // Categoría activa
let deliveryMode = 'delivery';  // Modo de envío: 'delivery' o 'takeaway'
let paymentMethod = 'efectivo'; // Método de pago seleccionado: 'efectivo' o 'transferencia'
let toastTimer;

// ─── HELPERS ─────────────────────────────────────────────────────
function tagLabel(t) {
  const map = {
    popular: '🔥 Popular',
    niños: '👶 Para Chicos',
    crocante: '⚡ Extra Crocante',
    exprés: '⏱️ Exprés',
    relleno: '🧀 Relleno',
    saludable: '🥗 Saludable',
    casero: '🏠 Casero',
    premium: '⭐ Premium',
    'sin-piel': '🍗 Sin Piel',
    gourmet: '🍷 Gourmet',
    fresco: '🍃 Fresco',
    mar: '🌊 De Mar',
    aromático: '🌿 Finas Hierbas',
    tradicional: '🇦🇷 Tradicional',
    natural: '🥬 Natural',
    vegetariana: '🌿 Veggie',
    'marca-premium': '🏆 McCain',
    granja: '🥚 De Campo',
    ahorro: '💰 Ahorro'
  };
  return map[t] || t;
}

function formatPrice(n) {
  return '$' + n.toLocaleString('es-AR');
}

/**
 * Devuelve el HTML de una foto con skeleton + fallback emoji.
 */
function photoHTML(src, emoji, alt = '') {
  const hasImage = src && src.trim() !== '';
  if (!hasImage) {
    return `<div class="item-photo-fallback show">${emoji}</div>`;
  }
  return `
    <div class="img-skeleton"></div>
    <img
      src="${src}"
      alt="${alt}"
      loading="lazy"
      onload="this.previousElementSibling.remove()"
      onerror="this.previousElementSibling.remove(); this.style.display='none'; this.nextElementSibling.style.opacity='1';"
    >
    <div class="item-photo-fallback" style="opacity:0">${emoji}</div>
  `;
}

function generateOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `#25-${code}`;
}

function scrollToPromo(idx) {
  const scroll = document.getElementById('promoScroll');
  const card = scroll ? scroll.querySelector('.promo-card') : null;
  if (scroll && card) {
    const cardWidth = card.offsetWidth + 10;
    scroll.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
  }
}

function promoCardCount() {
  const scroll = document.getElementById('promoScroll');
  if (!scroll) return 0;
  const all = scroll.querySelectorAll('.promo-card');
  // En mobile hay clones (mitad), en desktop no
  return window.innerWidth < 768 ? all.length / 2 : all.length;
}

// ─── LOCAL STORAGE PERSISTENCE ───
// Helper seguro para localStorage (evita caídas en navegadores que bloquean cookies de terceros o en el protocolo file://)
const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem bloqueado por el navegador:", e);
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem bloqueado por el navegador:", e);
    }
  }
};

function saveClientData() {
  const nombre = document.getElementById('fNombre') ? document.getElementById('fNombre').value.trim() : '';
  const tel = document.getElementById('fTel') ? document.getElementById('fTel').value.trim() : '';
  const dir = document.getElementById('fDir') ? document.getElementById('fDir').value.trim() : '';
  
  safeStorage.setItem('p25_nombre', nombre);
  safeStorage.setItem('p25_tel', tel);
  safeStorage.setItem('p25_dir', dir);
  safeStorage.setItem('p25_delivery', deliveryMode);
}

function loadClientData() {
  const nombre = safeStorage.getItem('p25_nombre') || '';
  const tel = safeStorage.getItem('p25_tel') || '';
  const dir = safeStorage.getItem('p25_dir') || '';
  const delivery = safeStorage.getItem('p25_delivery') || 'delivery';
  
  if (document.getElementById('fNombre')) document.getElementById('fNombre').value = nombre;
  if (document.getElementById('fTel')) document.getElementById('fTel').value = tel;
  if (document.getElementById('fDir')) document.getElementById('fDir').value = dir;
  
  setDelivery(delivery);
}

function saveLastOrder() {
  safeStorage.setItem('p25_last_cart', JSON.stringify(cart));
}



// ─── FREE SHIPPING TRACKER ───
function updateFreeShippingTracker(total) {
  const container = document.getElementById('freeShippingContainer');
  if (!container) return;

  if (deliveryMode === 'takeaway') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  
  const fill = document.getElementById('freeShippingFill');
  const msg = document.getElementById('freeShippingMsg');
  const suggestions = document.getElementById('freeShippingSuggestions');
  const progressBg = container.querySelector('.fs-progress-bg');

  if (progressBg) progressBg.style.display = 'none';
  if (suggestions) suggestions.style.display = 'none';

  if (msg) {
    msg.innerHTML = '🛵 ¡Envío <strong>100% Gratis</strong> sin monto mínimo!';
    msg.style.textAlign = 'center';
    msg.style.width = '100%';
    msg.style.display = 'block';
  }
}

function addQuickSuggestion(id) {
  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const opt = (item.unitType === 'peso' || item.unitType === 'mixto') ? '1kg' : 'unidad';
  const cartKey = `${id}-${opt}`;
  
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  updateAll(id);
  showToast(`💡 ${item.name} agregado`);
}

// ─── KILO OPTIMIZER ───
function checkKiloOptimizer() {
  const alertBox = document.getElementById('optimizerAlert');
  if (!alertBox) return;

  // Buscar el primer producto pesable que tenga al menos 2 unidades de medio kilo
  const optimizable = MENU.find(item => {
    if (item.unitType !== 'peso' && item.unitType !== 'mixto') return false;
    const qtyHalf = cart[`${item.id}-0.5kg`] || 0;
    return qtyHalf >= 2;
  });

  if (optimizable) {
    const qtyHalf = cart[`${optimizable.id}-0.5kg`] || 0;
    const costHalf = qtyHalf * optimizable.priceHalf;
    const optimizedKilos = Math.floor(qtyHalf / 2);
    const remainingHalves = qtyHalf % 2;
    const costOptimized = (optimizedKilos * optimizable.price) + (remainingHalves * optimizable.priceHalf);
    const saving = costHalf - costOptimized;

    if (saving > 0) {
      alertBox.innerHTML = `
        <div class="opt-header">
          <span class="opt-icon">💡</span>
          <span class="opt-title">¡Sugerencia de Ahorro!</span>
        </div>
        <div class="opt-body">
          Tenés <strong>${qtyHalf} unidades de 500g</strong> de <strong>${optimizable.name}</strong> en tu carrito. Si lo unificás a Kilos completos, ¡te ahorrás <strong>${formatPrice(saving)}</strong>!
        </div>
        <div class="opt-footer">
          <button class="opt-btn" onclick="optimizeWeight(${optimizable.id})">Optimizar y Ahorrar 💰</button>
        </div>
      `;
      alertBox.style.display = 'flex';
      return;
    }
  }
  
  alertBox.style.display = 'none';
}

function optimizeWeight(id) {
  const keyHalf = `${id}-0.5kg`;
  const keyKilo = `${id}-1kg`;
  const qtyHalf = cart[keyHalf] || 0;
  
  if (qtyHalf >= 2) {
    const optimizedKilos = Math.floor(qtyHalf / 2);
    const remainingHalves = qtyHalf % 2;
    
    cart[keyKilo] = (cart[keyKilo] || 0) + optimizedKilos;
    if (remainingHalves > 0) {
      cart[keyHalf] = remainingHalves;
    } else {
      delete cart[keyHalf];
    }
    updateAll(id);
    showToast('⚡ ¡Pedido optimizado y unificado!');
  }
}

// ─── HORARIOS DE APERTURA REALTIME ───
function checkStoreSchedule() {
  const now = new Date();
  const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const hour = now.getHours();
  const min = now.getMinutes();
  const timeVal = hour * 100 + min; // Formato hhmm (ej. 14:30 -> 1430)
  
  let isOpen = false;
  let statusText = '';
  
  // Detectar feriados nacionales de Argentina
  function getArgentineanHoliday(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const key = `${m}-${d}`;
    const holidays = {
      "1-1": "Año Nuevo",
      "3-24": "Día de la Memoria",
      "4-2": "Día de las Malvinas",
      "4-3": "Viernes Santo",
      "5-1": "Día del Trabajador",
      "5-25": "Revolución de Mayo",
      "6-15": "Día de Güemes",
      "6-20": "Día de la Bandera",
      "7-9": "Día de la Independencia",
      "8-17": "Paso a la Inmortalidad de San Martín",
      "10-12": "Día del Respeto a la Diversidad Cultural",
      "11-23": "Día de la Soberanía Nacional",
      "12-8": "Inmaculada Concepción",
      "12-25": "Navidad"
    };
    return holidays[key] || null;
  }
  
  const holidayName = getArgentineanHoliday(now);
  
  if (holidayName) {
    // Feriados: 9 a 14 hs
    const openTime = 900;
    const closeTime = 1400;
    if (timeVal >= openTime && timeVal <= closeTime) {
      isOpen = true;
      statusText = `Feriado (${holidayName}) · Abierto de 9 a 14hs`;
    } else {
      if (timeVal < openTime) {
        statusText = `Cerrado · Hoy Feriado (${holidayName}) abrimos a las 09:00hs`;
      } else {
        statusText = `Cerrado hoy Feriado (${holidayName}) · Cerrado por el resto del día`;
      }
    }
  } else if (day >= 1 && day <= 5) {
    // Lunes a Viernes: Horario corrido 8:30 a 22 hs
    const openTime = 830;
    const closeTime = 2200;
    if (timeVal >= openTime && timeVal <= closeTime) {
      isOpen = true;
      statusText = 'Abierto ahora';
    } else {
      if (timeVal < openTime) {
        statusText = 'Cerrado ahora · Abrimos a las 08:30hs';
      } else {
        statusText = 'Cerrado ahora · Abrimos mañana a las 08:30hs';
      }
    }
  } else if (day === 6) {
    // Sábados: 9 a 14 hs y 17 a 22 hs
    const morningOpen = 900;
    const morningClose = 1400;
    const eveningOpen = 1700;
    const eveningClose = 2200;
    
    if ((timeVal >= morningOpen && timeVal <= morningClose) || 
        (timeVal >= eveningOpen && timeVal <= eveningClose)) {
      isOpen = true;
      statusText = 'Abierto ahora';
    } else {
      if (timeVal < morningOpen) {
        statusText = 'Cerrado ahora · Abrimos a las 09:00hs';
      } else if (timeVal > morningClose && timeVal < eveningOpen) {
        statusText = 'Cerrado ahora · Abrimos a las 17:00hs';
      } else {
        statusText = 'Cerrado ahora · Abrimos mañana (Domingo) a las 09:00hs';
      }
    }
  } else if (day === 0) {
    // Domingos: 9 a 14 hs
    const openTime = 900;
    const closeTime = 1400;
    if (timeVal >= openTime && timeVal <= closeTime) {
      isOpen = true;
      statusText = 'Abierto ahora';
    } else {
      if (timeVal < openTime) {
        statusText = 'Cerrado ahora · Abrimos a las 09:00hs';
      } else {
        statusText = 'Cerrado hoy · Abrimos mañana (Lunes) a las 08:30hs';
      }
    }
  }
  
  // Actualizar indicador en UI
  const greeting = document.getElementById('storeStatusGreeting');
  const indicator = greeting ? greeting.querySelector('.status-indicator-dot') : null;
  const label = document.getElementById('storeStatusText');
  
  if (greeting && indicator && label) {
    indicator.className = 'status-indicator-dot ' + (isOpen ? 'open' : 'closed');
    label.textContent = statusText;
  }
  
  // Modificar botón de envío en el panel
  const waBtn = document.querySelector('.wa-btn');
  if (waBtn) {
    if (isOpen) {
      waBtn.innerHTML = '<span class="wa-icon">📲</span> Enviar Pedido por WhatsApp';
    } else {
      waBtn.innerHTML = '<span class="wa-icon">📅</span> Agendar Pedido para la Apertura';
    }
  }
  
  return isOpen;
}

// ─── FUNCIÓN PARA LEER STOCK DESDE ADMIN ─────────────────────────
function getEnabledProducts() {
  try {
    const stockState = JSON.parse(localStorage.getItem('p25_stock_db') || '{}');
    return MENU.filter(p => {
      const s = stockState[p.id];
      return s === undefined || s.enabled === true;
    });
  } catch (e) {
    return MENU;
  }
}

// ─── RENDER MENU ─────────────────────────────────────────────────
function renderMenu(items) {
  const list = document.getElementById('menuList');
  list.innerHTML = '';

  items.forEach(item => {
    // Determinar la opción de peso por defecto si no está seteada
    if ((item.unitType === 'peso' || item.unitType === 'mixto') && !selectedWeights[item.id]) {
      selectedWeights[item.id] = '0.5kg';
    }

    const opt = (item.unitType === 'peso' || item.unitType === 'mixto') ? selectedWeights[item.id] : 'unidad';
    const cartKey = `${item.id}-${opt}`;
    const qty = cart[cartKey] || 0;
    const inCart = qty > 0;

    // Controles dinámicos
    const controls = inCart
      ? `<button class="qty-btn" onclick="changeQty(${item.id},-1,event)">−</button>
         <div class="qty-num" id="qn-${item.id}">${qty}</div>
         <button class="qty-btn" onclick="changeQty(${item.id},1,event)">+</button>`
      : `<button class="qty-add-btn" onclick="addItem(${item.id},event)">+</button>`;

    // Selector de peso (sólo para productos pesables o mixtos)
    let weightSelectorHTML = '';
    let priceLabelHTML = '';

    if (item.unitType === 'peso') {
      const activeHalf = opt === '0.5kg' ? 'active' : '';
      const activeKilo = opt === '1kg' ? 'active' : '';
      weightSelectorHTML = `
        <div class="weight-selector" onclick="event.stopPropagation()">
          <div class="weight-pill ${activeHalf}" onclick="setWeightOption(${item.id}, '0.5kg')">500g</div>
          <div class="weight-pill ${activeKilo}" onclick="setWeightOption(${item.id}, '1kg')">1kg</div>
        </div>`;

      const currentPrice = opt === '0.5kg' ? item.priceHalf : item.price;
      const unitText = opt === '0.5kg' ? '500g' : '1kg';
      priceLabelHTML = `${formatPrice(currentPrice)} <span class="price-unit">x ${unitText}</span>`;
    } else if (item.unitType === 'mixto') {
      const activeHalf = opt === '0.5kg' ? 'active' : '';
      const activeKilo = opt === '1kg' ? 'active' : '';
      const activeUnit = opt === 'unidad' ? 'active' : '';
      weightSelectorHTML = `
        <div class="weight-selector" onclick="event.stopPropagation()">
          <div class="weight-pill ${activeHalf}" onclick="setWeightOption(${item.id}, '0.5kg')">500g</div>
          <div class="weight-pill ${activeKilo}" onclick="setWeightOption(${item.id}, '1kg')">1kg</div>
          <div class="weight-pill ${activeUnit}" onclick="setWeightOption(${item.id}, 'unidad')">Unidad</div>
        </div>`;

      let currentPrice = item.price;
      let unitText = '1kg';
      if (opt === '0.5kg') {
        currentPrice = item.priceHalf;
        unitText = '500g';
      } else if (opt === 'unidad') {
        currentPrice = item.priceUnit;
        unitText = 'Unidad';
      }
      priceLabelHTML = `${formatPrice(currentPrice)} <span class="price-unit">x ${unitText}</span>`;
    } else {
      let unitSuffix = 'Unidad';
      let suffixHTML = `x ${unitSuffix}`;
      if (item.cat === 'almacen-huevos' && item.id === 46) {
        unitSuffix = 'Bandeja';
        suffixHTML = `x ${unitSuffix}`;
      }
      priceLabelHTML = `${formatPrice(item.price)} <span class="price-unit">${suffixHTML}</span>`;
    }

    const tags = item.tags
      .map(t => `<div class="item-tag ${t === 'popular' ? 'popular' : t === 'relleno' ? 'relleno' : t === 'premium' ? 'premium' : ''}">${tagLabel(t)}</div>`)
      .join('');

    list.innerHTML += `
      <div class="menu-item ${inCart ? 'in-cart' : ''}" id="mi-${item.id}" onclick="handleCardClick(${item.id})">
        <div class="item-photo">
          ${photoHTML(item.img, item.emoji, item.name)}
        </div>
        <div class="item-info">
          <div>
            <div class="item-name">${item.name}${ (item.unitType === 'peso' || item.unitType === 'mixto') ? ` <span class="item-weight-badge">${opt === '0.5kg' ? '500g' : (opt === '1kg' ? '1kg' : 'Unidad')}</span>` : '' }</div>
            <div class="item-desc">${item.desc}</div>
            ${weightSelectorHTML}
            <div class="item-tags">${tags}</div>
          </div>
          <div class="item-footer">
            <div class="item-price" id="pr-${item.id}">${priceLabelHTML}</div>
            <div class="item-controls" id="ctrl-${item.id}">${controls}</div>
          </div>
        </div>
      </div>`;
  });
}

function handleCardClick(id) {
  openProductModal(id);
}

// ─── PRODUCT DETAIL MODAL ACTIONS ───
function openProductModal(id) {
  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (overlay && modal) {
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  const labels = {
    'pollo-rebozado': 'Rebozados de Pollo',
    'carne-vacuna': 'Carne Vacuna',
    'pollo-granja': 'Granja y Cortes',
    'pescados-mariscos': 'Mar y Río (Pescados)',
    'veggie-soja': 'Veggie & Soja',
    'bocados-papas': 'Bocados & Papas',
    'almacen-huevos': 'Almacén y Huevos'
  };
  
  const categoryEl = document.getElementById('pmCategory');
  const titleEl = document.getElementById('pmTitle');
  const ratingEl = document.getElementById('pmRating');
  const descEl = document.getElementById('pmDesc');
  const ingSection = document.getElementById('pmIngredientsSection');
  const ingEl = document.getElementById('pmIngredients');
  const prepSection = document.getElementById('pmPrepSection');
  const prepEl = document.getElementById('pmPrep');
  const imgWrap = document.getElementById('pmImageWrap');

  if (categoryEl) categoryEl.textContent = (labels[item.cat] || 'Menú').toUpperCase();
  if (titleEl) titleEl.textContent = item.name;
  if (ratingEl) ratingEl.textContent = (item.rating || 4.8).toFixed(1);
  if (descEl) {
    descEl.textContent = item.desc;
    descEl.style.display = 'none';
  }

  if (ingSection) {
    ingSection.style.display = 'none';
  }

  if (prepSection) {
    prepSection.style.display = 'none';
  }

  if (imgWrap) {
    imgWrap.innerHTML = '';
    const hasImage = item.img && item.img.trim() !== '';
    if (hasImage) {
      imgWrap.innerHTML = `
        <div class="pm-img-skeleton"></div>
        <img class="pm-img-bg" src="${item.img}" alt="" onerror="this.style.display='none'">
        <img class="pm-img-main" src="${item.img}" alt="${item.name}" onload="this.previousElementSibling.previousElementSibling.remove()" onerror="this.previousElementSibling.previousElementSibling.remove(); this.style.display='none'; this.nextElementSibling.style.opacity='1';">
        <div class="pm-img-fallback" style="opacity:0">
          <span class="pm-fallback-emoji">${item.emoji}</span>
        </div>
      `;
    } else {
      imgWrap.innerHTML = `
        <div class="pm-img-fallback show">
          <span class="pm-fallback-emoji">${item.emoji}</span>
        </div>
      `;
    }
  }

  const priceVal = document.getElementById('pmPrice');
  const actionsWrap = document.getElementById('pmActions');

  if (priceVal && actionsWrap) {
    if (item.unitType === 'peso' || item.unitType === 'mixto') {
      const activeWeight = selectedWeights[item.id] || '0.5kg';
      
      const updateModalPriceAndActions = (weightOpt) => {
        selectedWeights[item.id] = weightOpt;
        
        let currentPrice = item.price;
        let unitText = '1kg';
        if (weightOpt === '0.5kg') {
          currentPrice = item.priceHalf;
          unitText = '500g';
        } else if (weightOpt === 'unidad') {
          currentPrice = item.priceUnit;
          unitText = 'Unidad';
        }
        
        priceVal.innerHTML = `${formatPrice(currentPrice)} <span class="pm-price-unit">x ${unitText}</span>`;
        const nameSuffix = (item.unitType === 'peso' || item.unitType === 'mixto')
          ? ` <span class="item-weight-badge">${weightOpt === '0.5kg' ? '500g' : (weightOpt === '1kg' ? '1kg' : 'Unidad')}</span>`
          : '';
        if (titleEl) titleEl.innerHTML = `${item.name}${nameSuffix}`;
        
        const cartKey = `${item.id}-${weightOpt}`;
        const qty = cart[cartKey] || 0;
        
        let actionHTML = '';
        if (qty > 0) {
          actionHTML = `
            <div class="pm-weight-selector-modal">
              <button class="pm-weight-pill-modal ${weightOpt === '0.5kg' ? 'active' : ''}" id="pmWeightHalfBtn">500g</button>
              <button class="pm-weight-pill-modal ${weightOpt === '1kg' ? 'active' : ''}" id="pmWeightKiloBtn">1kg</button>
              ${item.unitType === 'mixto' ? `<button class="pm-weight-pill-modal ${weightOpt === 'unidad' ? 'active' : ''}" id="pmWeightUnitBtn">Unidad</button>` : ''}
            </div>
            <div class="pm-qty-controls-modal">
              <button class="pm-qty-btn-modal" id="pmMinusBtn">−</button>
              <span class="pm-qty-num-modal">${qty} en el carrito</span>
              <button class="pm-qty-btn-modal" id="pmPlusBtn">+</button>
            </div>
          `;
        } else {
          actionHTML = `
            <div class="pm-weight-selector-modal">
              <button class="pm-weight-pill-modal ${weightOpt === '0.5kg' ? 'active' : ''}" id="pmWeightHalfBtn">500g</button>
              <button class="pm-weight-pill-modal ${weightOpt === '1kg' ? 'active' : ''}" id="pmWeightKiloBtn">1kg</button>
              ${item.unitType === 'mixto' ? `<button class="pm-weight-pill-modal ${weightOpt === 'unidad' ? 'active' : ''}" id="pmWeightUnitBtn">Unidad</button>` : ''}
            </div>
            <button class="pm-add-cart-btn" id="pmAddBtn">
              <span>🛒</span> Agregar al Carrito (${unitText})
            </button>
          `;
        }
        actionsWrap.innerHTML = actionHTML;
        
        const halfBtn = document.getElementById('pmWeightHalfBtn');
        const kiloBtn = document.getElementById('pmWeightKiloBtn');
        const unitBtn = document.getElementById('pmWeightUnitBtn');
        if (halfBtn) halfBtn.onclick = () => updateModalPriceAndActions('0.5kg');
        if (kiloBtn) kiloBtn.onclick = () => updateModalPriceAndActions('1kg');
        if (unitBtn) unitBtn.onclick = () => updateModalPriceAndActions('unidad');
        
        const addBtn = document.getElementById('pmAddBtn');
        if (addBtn) {
          addBtn.onclick = () => {
            addItemFromModal(item.id, weightOpt);
            updateModalPriceAndActions(weightOpt);
          };
        }
        
        const minusBtn = document.getElementById('pmMinusBtn');
        const plusBtn = document.getElementById('pmPlusBtn');
        if (minusBtn) {
          minusBtn.onclick = () => {
            changeQtyFromModal(item.id, weightOpt, -1);
            updateModalPriceAndActions(weightOpt);
          };
        }
        if (plusBtn) {
          plusBtn.onclick = () => {
            changeQtyFromModal(item.id, weightOpt, 1);
            updateModalPriceAndActions(weightOpt);
          };
        }
      };
      
      updateModalPriceAndActions(activeWeight);
      
    } else {
      let unitSuffix = 'Unidad';
      let suffixHTML = `x ${unitSuffix}`;
      if (item.cat === 'almacen-huevos' && item.id === 46) {
        unitSuffix = 'Bandeja';
        suffixHTML = `x ${unitSuffix}`;
      }
      
      const updateModalPriceAndActionsUnit = () => {
        priceVal.innerHTML = `${formatPrice(item.price)} <span class="pm-price-unit">${suffixHTML}</span>`;
        const cartKey = `${item.id}-unidad`;
        const qty = cart[cartKey] || 0;
        
        let actionHTML = '';
        if (qty > 0) {
          actionHTML = `
            <div class="pm-qty-controls-modal">
              <button class="pm-qty-btn-modal" id="pmMinusBtn">−</button>
              <span class="pm-qty-num-modal">${qty} en el carrito</span>
              <button class="pm-qty-btn-modal" id="pmPlusBtn">+</button>
            </div>
          `;
        } else {
          actionHTML = `
            <button class="pm-add-cart-btn" id="pmAddBtn">
              <span>🛒</span> Agregar al Carrito
            </button>
          `;
        }
        actionsWrap.innerHTML = actionHTML;
        
        const addBtn = document.getElementById('pmAddBtn');
        if (addBtn) {
          addBtn.onclick = () => {
            addItemFromModal(item.id, 'unidad');
            updateModalPriceAndActionsUnit();
          };
        }
        
        const minusBtn = document.getElementById('pmMinusBtn');
        const plusBtn = document.getElementById('pmPlusBtn');
        if (minusBtn) {
          minusBtn.onclick = () => {
            changeQtyFromModal(item.id, 'unidad', -1);
            updateModalPriceAndActionsUnit();
          };
        }
        if (plusBtn) {
          plusBtn.onclick = () => {
            changeQtyFromModal(item.id, 'unidad', 1);
            updateModalPriceAndActionsUnit();
          };
        }
      };
      
      updateModalPriceAndActionsUnit();
    }
  }
}

function closeProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (overlay) overlay.classList.remove('open');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  
  const enabledItems = getEnabledProducts();
  const activeItems = currentCat === 'todos' ? enabledItems : enabledItems.filter(i => i.cat === currentCat);
  renderMenu(activeItems);
}

function addItemFromModal(id, opt) {
  const cartKey = `${id}-${opt}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  updateAll(id);
  spawnParticle(id);
  const item = MENU.find(i => i.id === id);
  const unitText = (item.unitType === 'peso' || item.unitType === 'mixto') ? (opt === '0.5kg' ? ' x 500g' : (opt === '1kg' ? ' x 1kg' : ' x Unidad')) : '';
  showToast(`🍗 ${item.name}${unitText} agregado`);
}

function changeQtyFromModal(id, opt, delta) {
  const cartKey = `${id}-${opt}`;
  cart[cartKey] = Math.max(0, (cart[cartKey] || 0) + delta);
  if (cart[cartKey] === 0) delete cart[cartKey];
  updateAll(id);
}

// Cambiar la opción de peso de un producto
function setWeightOption(id, option) {
  selectedWeights[id] = option;
  
  // Re-renderizar el item para actualizar el precio y contador correspondiente sin perder foco
  const item = MENU.find(i => i.id === id);
  if (item) {
    // Buscamos si el item está en la vista actual
    const el = document.getElementById('mi-' + id);
    if (el) {
      // Re-renderizamos los items de la categoría para refrescar de forma limpia
      const enabledItems = getEnabledProducts();
      const activeItems = currentCat === 'todos' ? enabledItems : enabledItems.filter(i => i.cat === currentCat);
      renderMenu(activeItems);
    }
  }
}



// ─── CATEGORY FILTER ─────────────────────────────────────────────
function filterCat(cat) {
  currentCat = cat;

  document.querySelectorAll('.cat-card').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === cat);
  });

  const enabledItems = getEnabledProducts();
  const items = cat === 'todos' ? enabledItems : enabledItems.filter(i => i.cat === cat);
  const labels = {
    todos: '🍽️ Catálogo Completo',
    'pollo-rebozado': '🍗 Rebozados de Pollo',
    'carne-vacuna': '🥩 Carne Vacuna',
    'pollo-granja': '🐔 Granja y Cortes',
    'pescados-mariscos': '🐟 Mar y Río (Pescados)',
    'veggie-soja': '🌿 Veggie & Soja',
    'bocados-papas': '🍟 Bocados & Papas',
    'almacen-huevos': '🥚 Almacén y Huevos'
  };

  document.getElementById('menuTitle').textContent = labels[cat] || '🍽️ Menú';
  renderMenu(items);
}



function filterMenu() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  if (!q) { filterCat(currentCat); return; }

  const enabledItems = getEnabledProducts();
  const items = enabledItems.filter(i =>
    i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)
  );
  document.getElementById('menuTitle').textContent = `🔍 "${q}"`;
  renderMenu(items);
}

// ─── CART ACTIONS ─────────────────────────────────────────────────
function addItem(id, event) {
  if (event) event.stopPropagation();

  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const opt = (item.unitType === 'peso' || item.unitType === 'mixto') ? (selectedWeights[id] || '0.5kg') : 'unidad';
  const cartKey = `${id}-${opt}`;

  cart[cartKey] = (cart[cartKey] || 0) + 1;

  updateAll(id);
  spawnParticle(id);

  const unitText = (item.unitType === 'peso' || item.unitType === 'mixto') ? (opt === '0.5kg' ? ' x 500g' : (opt === '1kg' ? ' x 1kg' : ' x Unidad')) : '';
  showToast(`🍗 ${item.name}${unitText} agregado`);
}



function changeQty(id, delta, event) {
  if (event) event.stopPropagation();

  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const opt = (item.unitType === 'peso' || item.unitType === 'mixto') ? (selectedWeights[id] || '0.5kg') : 'unidad';
  const cartKey = `${id}-${opt}`;

  cart[cartKey] = Math.max(0, (cart[cartKey] || 0) + delta);
  if (cart[cartKey] === 0) delete cart[cartKey];

  updateAll(id);
}

function changeQtyByKey(key, delta) {
  cart[key] = Math.max(0, (cart[key] || 0) + delta);
  if (cart[key] === 0) delete cart[key];

  const [idStr] = key.split('-');
  updateAll(parseInt(idStr));
}

function updateAll(changedId) {
  // Feedback acústico pop al mutar el carrito de forma interactiva
  if (changedId !== 0) {
    playPop();
  }
  // Re-renderizamos los controles de la tarjeta afectada en la vista principal
  const item = MENU.find(i => i.id === changedId);
  if (item) {
    const opt = (item.unitType === 'peso' || item.unitType === 'mixto') ? (selectedWeights[changedId] || '0.5kg') : 'unidad';
    const cartKey = `${changedId}-${opt}`;
    const qty = cart[cartKey] || 0;

    const ctrl = document.getElementById('ctrl-' + changedId);
    const mi = document.getElementById('mi-' + changedId);

    if (ctrl) {
      if (qty > 0) {
        ctrl.innerHTML = `
          <button class="qty-btn" onclick="changeQty(${changedId},-1,event)">−</button>
          <div class="qty-num" id="qn-${changedId}">${qty}</div>
          <button class="qty-btn" onclick="changeQty(${changedId},1,event)">+</button>`;
        mi.classList.add('in-cart');
      } else {
        ctrl.innerHTML = `<button class="qty-add-btn" onclick="addItem(${changedId},event)">+</button>`;
        mi.classList.remove('in-cart');
      }
    }
  }

  // Refrescar badge general
  updateCartBadge();

  // Si el panel del carrito está abierto, re-renderizarlo
  if (document.getElementById('cartPanel').classList.contains('open')) {
    renderCartPanel();
  }
}

function getTotals() {
  let count = 0, total = 0;
  Object.entries(cart).forEach(([key, qty]) => {
    const [idStr, opt] = key.split('-');
    const item = MENU.find(i => i.id === parseInt(idStr));
    if (item) {
      count += qty;
      let price = item.price;
      if (opt === '0.5kg' && item.priceHalf) {
        price = item.priceHalf;
      } else if (opt === 'unidad' && item.priceUnit) {
        price = item.priceUnit;
      }
      total += price * qty;
    }
  });
  return { count, total };
}

function updateCartBadge() {
  const { count, total } = getTotals();

  document.getElementById('cartCount').textContent = count;
  document.getElementById('btnCount').textContent = count;
  document.getElementById('btnTotal').textContent = formatPrice(total);
  document.getElementById('orderBtn').classList.toggle('active', count > 0);

  const cc = document.getElementById('cartCount');
  cc.classList.remove('bump');
  void cc.offsetWidth;
  cc.classList.add('bump');
}

// ─── CART PANEL ───────────────────────────────────────────────────
function openCart() {
  document.getElementById('cartPanel').classList.add('open');
  document.getElementById('panelOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartPanel();
}

function closeCart() {
  document.getElementById('cartPanel').classList.remove('open');
  document.getElementById('panelOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function selectWaChannel(idx) {
  selectedWaIdx = idx;
  document.getElementById('waCard0').classList.toggle('active', idx === 0);
  document.getElementById('waCard1').classList.toggle('active', idx === 1);
}

function renderCartPanel() {
  const { count, total } = getTotals();
  const content = document.getElementById('cartContent');
  const form = document.getElementById('cartForm');

  if (count === 0) {
    content.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-emoji">🛒</div>
        <div class="cart-empty-text">Tu carrito está vacío.<br>¡Agregá algo rico del catálogo!</div>
      </div>`;
    form.style.display = 'none';
    
    // Ocultar barras de envío gratis y optimizador si está vacío
    if (document.getElementById('freeShippingContainer')) document.getElementById('freeShippingContainer').style.display = 'none';
    if (document.getElementById('optimizerAlert')) document.getElementById('optimizerAlert').style.display = 'none';
    return;
  }

  let rows = '<div class="cart-list">';
  Object.entries(cart).forEach(([key, qty]) => {
    const [idStr, opt] = key.split('-');
    const item = MENU.find(i => i.id === parseInt(idStr));
    if (!item) return;

    const price = (opt === '0.5kg' && item.priceHalf) ? item.priceHalf : ((opt === 'unidad' && item.priceUnit) ? item.priceUnit : item.price);
    
    // Label de la opción seleccionada
    let optionLabel = '';
    if (item.unitType === 'peso' || item.unitType === 'mixto') {
      optionLabel = opt === '0.5kg' ? ' x 500g' : (opt === '1kg' ? ' x 1kg' : ' x Unidad');
    } else {
      let unitSuffix = 'Unidad';
      if (item.cat === 'almacen-huevos' && item.id === 46) unitSuffix = 'Bandeja';
      optionLabel = ` (${unitSuffix})`;
    }

    rows += `
      <div class="cart-row">
        <div class="cart-row-photo">
          ${item.img ? `<img src="${item.img}" alt="${item.name}">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px">${item.emoji}</div>`}
        </div>
        <div class="cart-row-info">
          <div class="cart-row-name">${item.name}${optionLabel}</div>
          <div class="cart-row-price">${formatPrice(price * qty)}</div>
        </div>
        <div class="cart-row-controls">
          <button class="qty-btn" onclick="changeQtyByKey('${key}',-1)">−</button>
          <div class="qty-num">${qty}</div>
          <button class="qty-btn" onclick="changeQtyByKey('${key}',1)">+</button>
        </div>
      </div>`;
  });
  rows += '</div>';

  const envio = 0;
  rows += `<div class="cart-subtotal"><span>Subtotal Productos</span><span>${formatPrice(total)}</span></div>`;
  rows += `<div class="cart-subtotal">
    <span>Envío ${deliveryMode === 'delivery' ? '🛵 Gratis' : '🏃 Retiro en Local'}</span>
    <span>¡Gratis! 🎉</span>
  </div>`;
  rows += `<div class="cart-total"><span>Total Final</span><span>${formatPrice(total)}</span></div>`;
  rows += '<div style="height:10px"></div>';

  content.innerHTML = rows;
  form.style.display = 'block';
  document.getElementById('addressSection').style.display = deliveryMode === 'delivery' ? 'block' : 'none';

  // Actualizar los widgets interactivos de la cabecera del carrito
  updateFreeShippingTracker(total);
  checkKiloOptimizer();

  // Mantener actualizado el vuelto y la visualización de la sección de pago
  setPaymentMethod(paymentMethod);
}

// ─── DELIVERY MODE ────────────────────────────────────────────────
function setDelivery(mode) {
  deliveryMode = mode;
  document.getElementById('dBtn1').classList.toggle('active', mode === 'delivery');
  document.getElementById('dBtn2').classList.toggle('active', mode === 'takeaway');
  renderCartPanel();
}

// ─── PAYMENT METHOD ───────────────────────────────────────────────
function setPaymentMethod(method) {
  paymentMethod = method;
  const payCashBtn = document.getElementById('payCashBtn');
  const payTransBtn = document.getElementById('payTransBtn');
  const cashSection = document.getElementById('cashSection');
  const transferSection = document.getElementById('transferSection');

  if (payCashBtn) payCashBtn.classList.toggle('active', method === 'efectivo');
  if (payTransBtn) payTransBtn.classList.toggle('active', method === 'transferencia');
  if (cashSection) cashSection.style.display = method === 'efectivo' ? 'block' : 'none';
  if (transferSection) transferSection.style.display = method === 'transferencia' ? 'block' : 'none';

  if (method === 'efectivo') {
    calculateChange();
  }
}

function calculateChange() {
  const totalObj = getTotals();
  const shipping = 0;
  const finalTotal = totalObj.total + shipping;

  const inputEl = document.getElementById('fVuelto');
  const resultEl = document.getElementById('changeResult');
  const amountEl = document.getElementById('changeAmount');

  if (!inputEl || !resultEl || !amountEl) return;

  const payVal = parseFloat(inputEl.value);
  if (isNaN(payVal) || payVal <= 0) {
    resultEl.style.display = 'none';
    return;
  }

  if (payVal >= finalTotal) {
    const change = payVal - finalTotal;
    amountEl.textContent = formatPrice(change);
    resultEl.style.display = 'block';
  } else {
    resultEl.style.display = 'none';
  }
}

function copyToClipboard(elementId, successMsg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 " + successMsg);
  }).catch(err => {
    // Fallback para entornos no HTTPS o navegadores antiguos
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("📋 " + successMsg);
    } catch (err2) {
      showToast("⚠️ No se pudo copiar");
    }
    document.body.removeChild(textArea);
  });
}

// ─── SEND WHATSAPP ORDER ──────────────────────────────────────────
function sendWhatsApp() {
  const nombre = document.getElementById('fNombre').value.trim();
  const tel = document.getElementById('fTel').value.trim();
  const dir = document.getElementById('fDir').value.trim();

  if (!nombre || !tel) { showToast('⚠️ Completá tu nombre y teléfono'); return; }
  if (deliveryMode === 'delivery' && !dir) { showToast('⚠️ Ingresá tu dirección de entrega'); return; }



  processWhatsAppOrder();
}



async function processWhatsAppOrder() {
  const nombre = document.getElementById('fNombre').value.trim();
  const tel = document.getElementById('fTel').value.trim();
  const dir = document.getElementById('fDir').value.trim();
  const nota = document.getElementById('fNota').value.trim();
  const vueltoInput = document.getElementById('fVuelto');
  const payWith = vueltoInput ? parseFloat(vueltoInput.value) : 0;

  if (!nombre || !tel) { showToast('⚠️ Completá tu nombre y teléfono'); return; }
  if (deliveryMode === 'delivery' && !dir) { showToast('⚠️ Ingresá tu dirección de entrega'); return; }

  const { total } = getTotals();
  const envio = 0;
  const waNumber = '549' + WA_NUMBERS[selectedWaIdx]; // Código país + número
  const orderId = generateOrderId();

  let msg = `🐔 *PEDIDO ${orderId} - Punto 25 Delivery* 🐔\n\n`;
  msg += `👤 *Cliente:* ${nombre}\n`;
  msg += `📞 *Teléfono:* ${tel}\n`;
  msg += deliveryMode === 'delivery'
    ? `📍 *Dirección de Entrega:* ${dir}\n`
    : `🏃 *Modalidad:* Retiro en local (Corrientes 664)\n`;
  
  // Agregar Renglón de Método de Pago
  const finalTotal = total + envio;
  if (paymentMethod === 'efectivo') {
    msg += `💵 *Método de Pago:* Efectivo\n`;
    if (payWith > 0 && payWith >= finalTotal) {
      msg += `💰 *Paga con:* ${formatPrice(payWith)} (Vuelto: ${formatPrice(payWith - finalTotal)})\n`;
    }
  } else {
    msg += `📱 *Método de Pago:* Transferencia Bancaria (Comprobante pendiente)\n`;
  }
  
  msg += `\n🛒 *Detalle del Pedido:*\n`;

  // Compilar los items para la generación del ticket digital
  const receiptItems = [];
  const itemsDetailText = [];

  Object.entries(cart).forEach(([key, qty]) => {
    const [idStr, opt] = key.split('-');
    const item = MENU.find(i => i.id === parseInt(idStr));
    if (item) {
      const price = (opt === '0.5kg' && item.priceHalf) ? item.priceHalf : ((opt === 'unidad' && item.priceUnit) ? item.priceUnit : item.price);
      
      let optLabel = '';
      if (item.unitType === 'peso' || item.unitType === 'mixto') {
        optLabel = opt === '0.5kg' ? ' (500g)' : (opt === '1kg' ? ' (1kg)' : ' (Unidad)');
      } else {
        let suffix = 'Unidad';
        if (item.cat === 'almacen-huevos' && item.id === 46) suffix = 'Bandeja';
        optLabel = ` (${suffix})`;
      }

      msg += `  • ${qty}x ${item.emoji} ${item.name}${optLabel} — ${formatPrice(price * qty)}\n`;
      itemsDetailText.push(`${qty}x ${item.name}${optLabel}`);
      
      // Agregar al arreglo del recibo
      receiptItems.push({
        name: item.name,
        qty: qty,
        price: price,
        optText: optLabel
      });
    }
  });

  if (deliveryMode === 'delivery') {
    msg += `\n🛵 *Envío:* ¡Gratis! 🎉\n`;
  }
  msg += `💰 *TOTAL FINAL: ${formatPrice(total + envio)}*\n`;
  
  if (nota) {
    msg += `\n📝 *Aclaraciones:* ${nota}\n`;
  }
  
  msg += `\n📍 _Enviado desde el catálogo web de Punto 25_`;

  // --- REGISTRO DE GOOGLE SHEETS ---
  const sheetPayload = {
    orderId: orderId,
    nombre: nombre,
    tel: tel,
    deliveryMode: deliveryMode === 'delivery' ? '🛵 Delivery' : '🏃 Retiro',
    direccion: deliveryMode === 'delivery' ? dir : 'Retiro en Local (Corrientes 664)',
    paymentMethod: paymentMethod === 'efectivo' ? '💵 Efectivo' : '📱 Transferencia',
    detalle: itemsDetailText.join('\n'),
    total: total + envio,
    pagoDetalle: paymentMethod === 'efectivo' ? (payWith > 0 ? `Paga con: ${formatPrice(payWith)} (Vuelto: ${formatPrice(payWith - finalTotal)})` : 'Pago exacto') : 'N/A',
    notes: nota
  };

  if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== '' && !GOOGLE_SHEETS_URL.includes('Reemplazar')) {
    showToast("⏳ Registrando pedido en planilla...");
    
    // Si se corre localmente como archivo (file://), fetch se bloquea por CORS.
    // Usamos el formulario oculto directamente en ese caso. Para HTTP/HTTPS usamos fetch directo.
    const isLocalFile = window.location.protocol === 'file:';
    
    if (isLocalFile) {
      console.log("Detectado protocolo file://. Registrando mediante formulario oculto.");
      try {
        sendDataViaHiddenForm(GOOGLE_SHEETS_URL, sheetPayload);
        // Espera de 800ms para asegurar que el navegador envíe el formulario antes de ir a WhatsApp
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (formErr) {
        console.error("Error en envío por formulario oculto:", formErr);
      }
    } else {
      console.log("Detectado protocolo web (HTTP/HTTPS). Registrando mediante fetch en background.");
      // Usamos keepalive: true para asegurar que la solicitud continúe en segundo plano 
      // y no usamos 'await' para que la redirección a WhatsApp sea inmediata y síncrona,
      // evitando así que los bloqueadores de popups de iOS / iPhone interfieran.
      fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(sheetPayload)
      }).catch(err => {
        console.warn("Fallo en registro en segundo plano de Google Sheets:", err);
      });
    }
  }

  // Guardar datos del cliente de forma permanente
  saveClientData();
  saveLastOrder();

  // Abrir WhatsApp (usar redirección directa en móviles para evitar bloqueo de popups en iOS)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  if (isMobile) {
    window.location.href = waUrl;
  } else {
    window.open(waUrl, '_blank');
  }
  
  // Cerrar el panel del carrito
  closeCart();
  
  // Abrir la ventana del ticket de compra digital interactivo en pantalla
  const changeValue = (paymentMethod === 'efectivo' && payWith >= finalTotal) ? (payWith - finalTotal) : 0;
  setTimeout(() => {
    openReceiptModal(orderId, nombre, tel, deliveryMode === 'delivery', receiptItems, total, envio, paymentMethod, payWith, changeValue);
  }, 400);
  
  showToast(`📲 Pedido ${orderId} enviado a WhatsApp`);
  

}

// ─── TOAST NOTIFICATION ──────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── FLAGGING PARTICLES (Micro-animations) ──────────────────────
function spawnParticle(id) {
  const el = document.getElementById('mi-' + id);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'particle';
  
  const item = MENU.find(i => i.id === id);
  p.textContent = item ? item.emoji : '🍗';
  
  p.style.left = (rect.left + rect.width / 2 - 12) + 'px';
  p.style.top = (rect.top + window.scrollY) + 'px';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 800);
}

// ─── PROMOTIONS AUTOMATION ────────────────────────────────────────
function initPromoDots() {
  const promoScroll = document.getElementById('promoScroll');
  if (!promoScroll) return;
  promoScroll.addEventListener('scroll', () => {
    const total = promoCardCount();
    if (!total) return;
    const idx = Math.round(promoScroll.scrollLeft / promoScroll.offsetWidth) % total;
    document.querySelectorAll('.promo-dots .dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  });
}

function initPromoAutoScroll() {
  const promoScroll = document.getElementById('promoScroll');
  const promoWrap = document.getElementById('fsPromo');
  if (!promoScroll || !promoWrap) return;

  const cards = promoScroll.querySelectorAll('.promo-card');
  if (cards.length < 2) return;

  let currentIndex = 0;
  let intervalId = null;
  let paused = false;

  function nextSlide() {
    if (paused) return;
    currentIndex++;
    if (currentIndex >= cards.length) {
      currentIndex = 0; // Rewind to first
    }
    scrollToPromo(currentIndex);
  }

  function startAutoPlay() {
    if (!intervalId) {
      intervalId = setInterval(nextSlide, 3500); // Change banner every 3.5 seconds
    }
  }

  function stopAutoPlay() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Update current index when scrolled manually
  promoScroll.addEventListener('scroll', () => {
    const cardWidth = cards[0].offsetWidth + 10;
    const newIndex = Math.round(promoScroll.scrollLeft / cardWidth);
    if (newIndex >= 0 && newIndex < cards.length) {
      currentIndex = newIndex;
    }
  });

  promoWrap.addEventListener('mouseenter', () => { paused = true; });
  promoWrap.addEventListener('mouseleave', () => { paused = false; });
  promoWrap.addEventListener('touchstart', () => { paused = true; }, { passive: true });
  promoWrap.addEventListener('touchend', () => { paused = false; }, { passive: true });

  startAutoPlay();
}

// ─── SCROLL INTERSECTION OBSERVERS ────────────────────────────────
function initScrollObserver() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-section').forEach(el => observer.observe(el));
}

// ─── INIT ─────────────────────────────────────────────────────────
async function loadCatalog() {
  try {
    const cached = safeStorage.getItem("p25_catalog_db");
    if (cached) {
      MENU = JSON.parse(cached);
      if (typeof filterCat === 'function' && !document.getElementById('catalogGrid')) filterCat(currentCat);
    }
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getCatalog" })
    });
    const result = await response.json();
    if (result.status === "success" && result.data && result.data.length > 0) {
      MENU = result.data.map(p => ({
        id: parseInt(p.id),
        cat: p.cat,
        name: p.name,
        desc: p.desc,
        ingredients: p.ingredients,
        prepDesc: p.prepDesc,
        prepTime: p.prepTime,
        price: parseInt(p.price),
        priceHalf: parseInt(p.priceHalf) || 0,
        unitType: p.unitType,
        img: p.img,
        emoji: p.emoji,
        tags: typeof p.tags === 'string' ? p.tags.split(',').map(t=>t.trim()).filter(t=>t) : [],
        hot: p.hot === true || p.hot === 'true' || p.hot === 'TRUE',
        rating: parseFloat(p.rating) || 4.8,
        enabled: p.enabled !== false && p.enabled !== 'false' && p.enabled !== 'FALSE'
      }));
      safeStorage.setItem("p25_catalog_db", JSON.stringify(MENU));
      if (typeof filterCat === 'function' && !document.getElementById('catalogGrid')) filterCat(currentCat);
      if (typeof renderCatalog === 'function') renderCatalog();
      if (typeof populateEditProductSelect === 'function') populateEditProductSelect();
    }
  } catch (e) {
    console.warn("Fallo carga de catálogo, usando default:", e);
  }
}

function init() {
  loadCatalog();
  filterCat('todos');
  initPromoDots();
  initPromoAutoScroll();
  initScrollObserver();
  initSpotlightSearch();
  initTheme();
  loadClientData();

  checkStoreSchedule();
  
  // Chequeo automático de horario cada 30 segundos
  setInterval(checkStoreSchedule, 30000);
}

// Iniciar aplicación de forma segura cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ─── EXTRA UTILITIES & ELITE FEATURES ───

// 1. BÚSQUEDA INTELIGENTE POR VOZ (Speech-to-Text)
let recognition;
function startVoiceSearch(event) {
  if (event) event.stopPropagation();
  
  const voiceBtn = document.getElementById('voiceBtn');
  const searchInput = document.getElementById('searchInput');
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("🎙️ Tu navegador no soporta búsqueda por voz");
    return;
  }
  
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      voiceBtn.classList.add('recording');
      showToast("🎙️ Escuchando... Hablá ahora");
    };
    
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      searchInput.value = transcript;
      filterMenu(); // Buscar automáticamente
      showToast(`🔍 Dictado: "${transcript}"`);
    };
    
    recognition.onerror = (e) => {
      console.error("Error en reconocimiento de voz:", e);
      showToast("🎙️ No se detectó audio. Reintentá");
      voiceBtn.classList.remove('recording');
    };
    
    recognition.onend = () => {
      voiceBtn.classList.remove('recording');
    };
  }
  
  try {
    recognition.start();
  } catch (e) {
    recognition.stop();
  }
}

// 2. RECIBO DE COMPRA DIGITAL INTERACTIVO (Ticket)
function openReceiptModal(orderId, customerName, phone, isDelivery, itemsList, subtotal, shippingCost, method, payWith, change) {
  const overlay = document.getElementById('receiptOverlay');
  const modal = document.getElementById('receiptModal');
  
  document.getElementById('recId').textContent = orderId;
  
  const now = new Date();
  const dateString = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + 'hs';
  document.getElementById('recDate').textContent = dateString;
  
  document.getElementById('recName').textContent = customerName;
  document.getElementById('recTel').textContent = phone;
  document.getElementById('recDelivery').textContent = isDelivery ? '🛵 Delivery a Domicilio' : '🏃 Retiro en Local';
  
  // Renderizar método de pago en el recibo
  const recPayment = document.getElementById('recPayment');
  if (recPayment) {
    if (method === 'efectivo') {
      let payText = 'Efectivo';
      if (payWith > 0 && payWith >= (subtotal + shippingCost)) {
        payText += ` (Paga: ${formatPrice(payWith)}, Vuelto: ${formatPrice(change)})`;
      }
      recPayment.textContent = payText;
    } else {
      recPayment.textContent = 'Transferencia Bancaria';
    }
  }
  
  // Renderizar ítems como un recibo físico real
  const itemsEl = document.getElementById('recItems');
  itemsEl.innerHTML = itemsList.map(item => `
    <div class="receipt-item-row">
      <span class="receipt-item-name">${item.qty}x ${item.name}${item.optText}</span>
      <span>${formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('');
  
  document.getElementById('recSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('recShipping').textContent = shippingCost === 0 ? '¡Gratis! 🎉' : formatPrice(shippingCost);
  document.getElementById('recTotal').textContent = formatPrice(subtotal + shippingCost);
  
  if (overlay && modal) {
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Lanzar audio de éxito de caja registradora y confeti de festejo
    playChime();
    startCelebration();
  }
}

function closeReceiptModal() {
  const overlay = document.getElementById('receiptOverlay');
  const modal = document.getElementById('receiptModal');
  if (overlay) overlay.classList.remove('open');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  
  // Detener y limpiar la simulación de confeti festivo si sigue corriendo
  stopCelebration();
  
  // Limpiar y resetear el carrito tras el éxito comercial
  cart = {};
  selectedWeights = {};
  paymentMethod = 'efectivo'; // Resetear método de pago
  const vueltoEl = document.getElementById('fVuelto');
  if (vueltoEl) vueltoEl.value = '';
  
  // Salvar cambios limpios
  const nombre = document.getElementById('fNombre') ? document.getElementById('fNombre').value.trim() : '';
  const tel = document.getElementById('fTel') ? document.getElementById('fTel').value.trim() : '';
  const dir = document.getElementById('fDir') ? document.getElementById('fDir').value.trim() : '';
  safeStorage.setItem('p25_nombre', nombre);
  safeStorage.setItem('p25_tel', tel);
  safeStorage.setItem('p25_dir', dir);
  
  updateAll(0);
  filterCat('todos');
}

function downloadReceipt() {
  const orderId = document.getElementById('recId').textContent;
  const date = document.getElementById('recDate').textContent;
  const name = document.getElementById('recName').textContent;
  const tel = document.getElementById('recTel').textContent;
  const mode = document.getElementById('recDelivery').textContent;
  const payment = document.getElementById('recPayment') ? document.getElementById('recPayment').textContent : 'Efectivo';
  
  let ticketText = `========================================\n`;
  ticketText += `             PUNTO 25 DELIVERY          \n`;
  ticketText += `       Granja, Rebozados y Congelados   \n`;
  ticketText += `        Corrientes 664, Barrio Norte    \n`;
  ticketText += `========================================\n\n`;
  ticketText += `ID PEDIDO: ${orderId}\n`;
  ticketText += `FECHA:     ${date}\n`;
  ticketText += `CLIENTE:   ${name}\n`;
  ticketText += `TELEFONO:  ${tel}\n`;
  ticketText += `MODO:      ${mode}\n`;
  ticketText += `PAGO:      ${payment}\n`;
  ticketText += `----------------------------------------\n`;
  ticketText += `DETALLE DEL PEDIDO:\n`;
  
  const rows = document.querySelectorAll('.receipt-item-row');
  rows.forEach(row => {
    const name = row.querySelector('.receipt-item-name').textContent;
    const price = row.querySelector('span:last-child').textContent;
    const spacesCount = Math.max(1, 40 - name.length - price.length);
    ticketText += `${name}${" ".repeat(spacesCount)}${price}\n`;
  });
  
  ticketText += `----------------------------------------\n`;
  ticketText += `Subtotal:  ${document.getElementById('recSubtotal').textContent}\n`;
  ticketText += `Envío:     ${document.getElementById('recShipping').textContent}\n`;
  ticketText += `TOTAL:     ${document.getElementById('recTotal').textContent}\n`;
  ticketText += `========================================\n`;
  ticketText += `       *** GRACIAS POR SU COMPRA ***    \n`;
  ticketText += `========================================\n`;
  
  const blob = new Blob([ticketText], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ticket-${orderId}.txt`;
  link.click();
  showToast("📥 Recibo de texto descargado");
}

// 3. PANEL DE BÚSQUEDA INTELIGENTE (Spotlight Autocomplete)
function initSpotlightSearch() {
  const searchInput = document.getElementById('searchInput');
  const suggestionsEl = document.getElementById('searchSuggestions');
  
  if (!searchInput || !suggestionsEl) return;
  
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      suggestionsEl.style.display = 'none';
      return;
    }
    
    const matches = getEnabledProducts().filter(item => 
      item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    ).slice(0, 5);
    
    if (matches.length > 0) {
      suggestionsEl.innerHTML = matches.map(item => `
        <div class="suggestion-item" onclick="selectSpotlightSuggestion(${item.id})">
          <span class="sug-emoji">${item.emoji}</span>
          <span class="sug-name">${item.name}</span>
          <span class="sug-price">${formatPrice(item.price)}</span>
        </div>
      `).join('');
      suggestionsEl.style.display = 'flex';
    } else {
      suggestionsEl.style.display = 'none';
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsEl.contains(e.target)) {
      suggestionsEl.style.display = 'none';
    }
  });
}

function selectSpotlightSuggestion(id) {
  const suggestionsEl = document.getElementById('searchSuggestions');
  if (suggestionsEl) suggestionsEl.style.display = 'none';
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  
  openProductModal(id);
}

// 4. FILTROS RÁPIDOS POR TAGS
let activeTag = null;
function filterMenuByTag(tag) {
  // Desactivar categorías activas para enfocar la búsqueda por tags
  document.querySelectorAll('.cat-card').forEach(p => p.classList.remove('active'));
  
  const tagPills = document.querySelectorAll('.quick-tags-wrap .tag-pill');
  
  if (activeTag === tag) {
    activeTag = null;
    tagPills.forEach(p => p.classList.remove('active'));
    filterCat('todos');
    return;
  }
  
  activeTag = tag;
  tagPills.forEach(p => {
    p.classList.toggle('active', p.dataset.tag === tag);
  });
  
  const enabledItems = getEnabledProducts();
  let items = [];
  let titleText = '';
  
  if (tag === 'popular') {
    items = enabledItems.filter(i => i.tags.includes('popular') || i.hot || i.rating >= 4.9);
    titleText = '🔥 Los Más Vendidos del Catálogo';
  } else if (tag === 'relleno') {
    items = enabledItems.filter(i => i.tags.includes('relleno') || i.name.toLowerCase().includes('rellen') || i.name.toLowerCase().includes('mozzarella'));
    titleText = '🧀 Exquisiteces con Queso & Rellenos';
  } else if (tag === 'saludable') {
    items = enabledItems.filter(i => i.tags.includes('saludable') || i.cat === 'veggie-soja' || i.tags.includes('vegetariana'));
    titleText = '🥗 Línea Fit & Saludable';
  } else if (tag === 'niños') {
    items = enabledItems.filter(i => i.tags.includes('niños') || i.name.toLowerCase().includes('patitas') || i.name.toLowerCase().includes('nugget'));
    titleText = '👶 Menú Infantil Favorito';
  }
  
  document.getElementById('menuTitle').textContent = titleText;
  renderMenu(items);
  
  const menuTitleEl = document.getElementById('menuTitle');
  if (menuTitleEl) {
    menuTitleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// 5. MODO DÍA SIEMPRE ACTIVO (Modo oscuro desactivado a petición del cliente)
function toggleTheme() {
  // Desactivado
}

function initTheme() {
  document.body.classList.remove('dark');
  safeStorage.setItem('p25_theme', 'light');
}

// ─── AUDIO-FEEDBACK NATIVO (Web Audio API Synthesizers) ───
let audioCtxInstance = null;
function getAudioContext() {
  if (!audioCtxInstance) {
    audioCtxInstance = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtxInstance.state === 'suspended') {
    audioCtxInstance.resume();
  }
  return audioCtxInstance;
}

function playPop() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Descenso de frecuencia para simular un "pop" orgánico y limpio
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (e) {
    console.warn("AudioContext bloqueado o no soportado por el navegador:", e);
  }
}

function playChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // 1. Sonido metálico inicial (burst de ruido bandpass) de las monedas
    const bufferSize = ctx.sampleRate * 0.05; // 50ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // 2. Tono principal de la campana metálica de la caja
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // Nota B5 (si5)
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // 3. Armónico cristalino secundario (Campana aguda)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now); // Nota E6 (mi6)
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    noise.start(now);
    osc1.start(now);
    osc2.start(now);
    
    noise.stop(now + 0.06);
    osc1.stop(now + 0.9);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.warn("Error en la síntesis del chime de la caja registradora:", e);
  }
}

// ─── ESTALLIDO DE CONFETI Y EMOJIS (Celebration FX) ───
let celebrationActive = false;
let celebrationAnimationId = null;

function startCelebration() {
  const canvas = document.getElementById('celebrationCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.style.display = 'block';

  // Redimensionar el canvas a pantalla completa adaptándose a cualquier dispositivo
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const particles = [];
  const emojis = ['🍗', '🍟', '🥚', '🐔', '⚡', '🎉', '🌟', '🥓'];
  const colors = ['#0da1f5', '#07406f', '#ffd600', '#25D366', '#ff4b2b', '#e6683c', '#9b59b6'];

  // Crear 120 partículas con físicas dinámicas individuales
  const particleCount = 130;
  for (let i = 0; i < particleCount; i++) {
    const isEmoji = Math.random() < 0.28; // 28% de emojis del catálogo, 72% confeti de colores
    particles.push({
      x: canvas.width / 2 + (Math.random() * 80 - 40),
      y: canvas.height * 0.75, // Lanzar desde la zona baja-centro de la pantalla (cerca del modal)
      vx: (Math.random() * 12 - 6) * (1 + Math.random() * 0.5),
      vy: -(Math.random() * 16 + 12), // Fuerte impulso inicial vertical hacia arriba
      gravity: 0.38,
      friction: 0.975,
      size: isEmoji ? Math.random() * 12 + 18 : Math.random() * 6 + 6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() * 0.18 - 0.09),
      color: colors[Math.floor(Math.random() * colors.length)],
      emoji: isEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : null,
      opacity: 1,
      fadeSpeed: Math.random() * 0.006 + 0.005
    });
  }

  celebrationActive = true;
  let startTime = Date.now();

  function animate() {
    if (!celebrationActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeParticles = 0;

    particles.forEach(p => {
      if (p.opacity <= 0) return;

      activeParticles++;

      // Actualizar variables físicas
      p.vx *= p.friction;
      p.vy += p.gravity;
      p.vy *= p.friction;
      
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      
      // Empezar a desvanecer progresivamente tras 1.2 segundos de vuelo
      if (Date.now() - startTime > 1200) {
        p.opacity -= p.fadeSpeed;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      if (p.emoji) {
        ctx.font = `${p.size}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      } else {
        // Dibujar tiras de confeti rectangulares
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
      }

      ctx.restore();
    });

    // Detener animación si se agotan las partículas o si expira el tiempo límite
    if (activeParticles === 0 || Date.now() - startTime > 4500) {
      stopCelebration();
    } else {
      celebrationAnimationId = requestAnimationFrame(animate);
    }
  }

  if (celebrationAnimationId) {
    cancelAnimationFrame(celebrationAnimationId);
  }
  celebrationAnimationId = requestAnimationFrame(animate);
}

function stopCelebration() {
  celebrationActive = false;
  if (celebrationAnimationId) {
    cancelAnimationFrame(celebrationAnimationId);
    celebrationAnimationId = null;
  }
  const canvas = document.getElementById('celebrationCanvas');
  if (canvas) {
    canvas.style.display = 'none';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Fallback robusto para registrar pedidos en Google Sheets usando un formulario oculto en un iframe oculto.
// Este método es inmune a las restricciones de CORS y a los bloqueos de protocolos locales (como file://).
function sendDataViaHiddenForm(url, payload) {
  try {
    const iframeName = 'hidden_iframe_' + Date.now();
    
    // Crear el iframe oculto
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Crear el formulario oculto
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = iframeName;
    form.style.display = 'none';

    // Inyectar el campo de datos serializado como JSON
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    
    // Enviar formulario de fondo
    form.submit();

    // Limpieza de elementos del DOM tras 4 segundos
    setTimeout(() => {
      document.body.removeChild(form);
      document.body.removeChild(iframe);
    }, 4000);
  } catch (err) {
    console.error("Error al enviar mediante formulario oculto:", err);
  }
}