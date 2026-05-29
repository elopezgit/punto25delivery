// ─── STATE ───────────────────────────────────────────────────────
let cart = {};                  // Almacena: { "id-opcion": cantidad }
let selectedWeights = {};       // Almacena: { id: "1kg" o "0.5kg" }
let selectedWaIdx = 0;          // Índice del número de WhatsApp seleccionado (0 o 1)
let currentCat = 'todos';       // Categoría activa
let deliveryMode = 'delivery';  // Modo de envío: 'delivery' o 'takeaway'
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
    const cardWidth = card.offsetWidth + 10; // ancho tarjeta + gap de 10px en flex
    scroll.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
  }
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

function checkLastOrderHistory() {
  const lastCartStr = safeStorage.getItem('p25_last_cart');
  const banner = document.getElementById('historyBanner');
  if (lastCartStr && banner) {
    try {
      const lastCart = JSON.parse(lastCartStr);
      const keys = Object.keys(lastCart);
      if (keys.length > 0) {
        let descItems = [];
        keys.slice(0, 3).forEach(key => {
          const [idStr, opt] = key.split('-');
          const item = MENU.find(i => i.id === parseInt(idStr));
          if (item) {
            const optText = item.unitType === 'peso' ? (opt === '0.5kg' ? '½ Kg' : '1 Kg') : 'Unid.';
            descItems.push(`${item.name} (${optText})`);
          }
        });
        if (keys.length > 3) descItems.push('y más...');
        
        const descEl = document.getElementById('historyOrderDesc');
        if (descEl) descEl.textContent = descItems.join(', ');
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    } catch (e) {
      banner.style.display = 'none';
    }
  } else if (banner) {
    banner.style.display = 'none';
  }
}

function loadLastOrder(event) {
  if (event) event.stopPropagation();
  const lastCartStr = safeStorage.getItem('p25_last_cart');
  if (lastCartStr) {
    try {
      cart = JSON.parse(lastCartStr);
      Object.keys(cart).forEach(key => {
        const [idStr, opt] = key.split('-');
        if (opt === '1kg' || opt === '0.5kg') {
          selectedWeights[parseInt(idStr)] = opt;
        }
      });
      renderMenu(currentCat === 'todos' ? MENU : MENU.filter(i => i.cat === currentCat));
      updateCartBadge();
      showToast('🛒 ¡Pedido anterior cargado con éxito!');
      document.getElementById('historyBanner').style.display = 'none';
      openCart();
    } catch (e) {
      showToast('⚠️ Error al cargar el historial');
    }
  }
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
  const limit = 12000;
  const percent = Math.min(100, (total / limit) * 100);
  
  const fill = document.getElementById('freeShippingFill');
  const msg = document.getElementById('freeShippingMsg');
  const suggestions = document.getElementById('freeShippingSuggestions');
  const grid = document.getElementById('fsSugGrid');

  if (fill) fill.style.width = percent + '%';

  if (total >= limit) {
    if (msg) msg.innerHTML = '¡Felicidades! 🎉 ¡Conseguiste <strong>Envío Gratis</strong>!';
    if (suggestions) suggestions.style.display = 'none';
  } else {
    const remaining = limit - total;
    if (msg) msg.innerHTML = `¡Estás a <strong>${formatPrice(remaining)}</strong> de conseguir <strong>Envío Gratis</strong>!`;
    if (suggestions) suggestions.style.display = 'flex';
    
    // Sugerencias de productos complementarios baratos
    const sugItems = [
      { id: 45, name: 'Huevos Campo', price: 2200, emoji: '🥚' },
      { id: 43, name: 'Papas McCain', price: 3200, emoji: '🍟' },
      { id: 35, name: 'Tequeños', price: 3450, emoji: '🫔' },
      { id: 34, name: 'Bastones Mozzarella', price: 3650, emoji: '🧀' }
    ];

    if (grid) {
      grid.innerHTML = sugItems.map(s => `
        <div class="fs-sug-card" onclick="addQuickSuggestion(${s.id})">
          <span style="font-size:14px">${s.emoji}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-start">
            <span class="fs-sug-name">${s.name}</span>
            <span class="fs-sug-price">${formatPrice(s.price)}</span>
          </div>
          <button class="fs-sug-add">+</button>
        </div>
      `).join('');
    }
  }
}

function addQuickSuggestion(id) {
  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const opt = item.unitType === 'peso' ? '1kg' : 'unidad';
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
    if (item.unitType !== 'peso') return false;
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
          Tenés <strong>${qtyHalf} unidades de ½ Kg</strong> de <strong>${optimizable.name}</strong> en tu carrito. Si lo unificás a Kilos completos, ¡te ahorrás <strong>${formatPrice(saving)}</strong>!
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
  const timeVal = hour * 100 + min; // Formato hhmm (ej. 1430)
  
  let isOpen = false;
  let statusText = '';
  
  if (day >= 1 && day <= 6) { // Lunes a Sábado
    const morningOpen = 930;
    const morningClose = 1330;
    const eveningOpen = 1730;
    const eveningClose = 2130;
    
    if ((timeVal >= morningOpen && timeVal <= morningClose) || 
        (timeVal >= eveningOpen && timeVal <= eveningClose)) {
      isOpen = true;
      statusText = 'Abierto ahora · Entrega estimada 30-50 min';
    } else {
      if (timeVal < morningOpen) {
        statusText = 'Cerrado ahora · Abrimos a las 09:30hs';
      } else if (timeVal > morningClose && timeVal < eveningOpen) {
        statusText = 'Cerrado ahora · Abrimos a las 17:30hs';
      } else {
        statusText = 'Cerrado ahora · Abrimos mañana a las 09:30hs';
      }
    }
  } else { // Domingo cerrado
    statusText = 'Cerrado hoy Domingo · Abrimos Lunes 09:30hs';
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

// ─── RENDER MENU ─────────────────────────────────────────────────
function renderMenu(items) {
  const list = document.getElementById('menuList');
  list.innerHTML = '';

  items.forEach(item => {
    // Determinar la opción de peso por defecto si no está seteada
    if (item.unitType === 'peso' && !selectedWeights[item.id]) {
      selectedWeights[item.id] = '1kg';
    }

    const opt = item.unitType === 'peso' ? selectedWeights[item.id] : 'unidad';
    const cartKey = `${item.id}-${opt}`;
    const qty = cart[cartKey] || 0;
    const inCart = qty > 0;

    // Controles dinámicos
    const controls = inCart
      ? `<button class="qty-btn" onclick="changeQty(${item.id},-1,event)">−</button>
         <div class="qty-num" id="qn-${item.id}">${qty}</div>
         <button class="qty-btn" onclick="changeQty(${item.id},1,event)">+</button>`
      : `<button class="qty-add-btn" onclick="addItem(${item.id},event)">+</button>`;

    // Selector de peso (sólo para productos pesables)
    let weightSelectorHTML = '';
    let priceLabelHTML = '';

    if (item.unitType === 'peso') {
      const activeHalf = opt === '0.5kg' ? 'active' : '';
      const activeKilo = opt === '1kg' ? 'active' : '';
      weightSelectorHTML = `
        <div class="weight-selector" onclick="event.stopPropagation()">
          <div class="weight-pill ${activeHalf}" onclick="setWeightOption(${item.id}, '0.5kg')">½ Kg</div>
          <div class="weight-pill ${activeKilo}" onclick="setWeightOption(${item.id}, '1kg')">1 Kg</div>
        </div>`;

      const currentPrice = opt === '0.5kg' ? item.priceHalf : item.price;
      const unitText = opt === '0.5kg' ? '½ Kg' : 'Kg';
      priceLabelHTML = `${formatPrice(currentPrice)} <span class="price-unit">x ${unitText}</span>`;
    } else {
      let unitSuffix = 'Unidad';
      if (item.cat === 'almacen-huevos' && item.id === 45) unitSuffix = 'Docena';
      if (item.cat === 'almacen-huevos' && item.id === 46) unitSuffix = 'Bandeja';
      priceLabelHTML = `${formatPrice(item.price)} <span class="price-unit">x ${unitSuffix}</span>`;
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
            <div class="item-name">${item.name}</div>
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
  if (descEl) descEl.textContent = item.desc;

  if (ingSection && ingEl) {
    if (item.ingredients) {
      ingEl.textContent = item.ingredients;
      ingSection.style.display = 'block';
    } else {
      ingSection.style.display = 'none';
    }
  }

  if (prepSection && prepEl) {
    if (item.prepDesc) {
      let prepText = item.prepDesc;
      if (item.prepTime) {
        prepText += ` (Tiempo estimado: ${item.prepTime})`;
      }
      prepEl.textContent = prepText;
      prepSection.style.display = 'block';
    } else {
      prepSection.style.display = 'none';
    }
  }

  if (imgWrap) {
    imgWrap.innerHTML = '';
    const hasImage = item.img && item.img.trim() !== '';
    if (hasImage) {
      imgWrap.innerHTML = `
        <div class="pm-img-skeleton"></div>
        <img src="${item.img}" alt="${item.name}" onload="this.previousElementSibling.remove()" onerror="this.previousElementSibling.remove(); this.style.display='none'; this.nextElementSibling.style.opacity='1';">
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
    if (item.unitType === 'peso') {
      const activeWeight = selectedWeights[item.id] || '1kg';
      
      const updateModalPriceAndActions = (weightOpt) => {
        selectedWeights[item.id] = weightOpt;
        const currentPrice = weightOpt === '0.5kg' ? item.priceHalf : item.price;
        const unitText = weightOpt === '0.5kg' ? '½ Kg' : 'Kg';
        priceVal.innerHTML = `${formatPrice(currentPrice)} <span class="pm-price-unit">x ${unitText}</span>`;
        
        const cartKey = `${item.id}-${weightOpt}`;
        const qty = cart[cartKey] || 0;
        
        let actionHTML = '';
        if (qty > 0) {
          actionHTML = `
            <div class="pm-weight-selector-modal">
              <button class="pm-weight-pill-modal ${weightOpt === '0.5kg' ? 'active' : ''}" id="pmWeightHalfBtn">½ Kg</button>
              <button class="pm-weight-pill-modal ${weightOpt === '1kg' ? 'active' : ''}" id="pmWeightKiloBtn">1 Kg</button>
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
              <button class="pm-weight-pill-modal ${weightOpt === '0.5kg' ? 'active' : ''}" id="pmWeightHalfBtn">½ Kg</button>
              <button class="pm-weight-pill-modal ${weightOpt === '1kg' ? 'active' : ''}" id="pmWeightKiloBtn">1 Kg</button>
            </div>
            <button class="pm-add-cart-btn" id="pmAddBtn">
              <span>🛒</span> Agregar al Carrito (${unitText})
            </button>
          `;
        }
        actionsWrap.innerHTML = actionHTML;
        
        const halfBtn = document.getElementById('pmWeightHalfBtn');
        const kiloBtn = document.getElementById('pmWeightKiloBtn');
        if (halfBtn) halfBtn.onclick = () => updateModalPriceAndActions('0.5kg');
        if (kiloBtn) kiloBtn.onclick = () => updateModalPriceAndActions('1kg');
        
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
      if (item.cat === 'almacen-huevos' && item.id === 45) unitSuffix = 'Docena';
      if (item.cat === 'almacen-huevos' && item.id === 46) unitSuffix = 'Bandeja';
      
      const updateModalPriceAndActionsUnit = () => {
        priceVal.innerHTML = `${formatPrice(item.price)} <span class="pm-price-unit">x ${unitSuffix}</span>`;
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
  
  const activeItems = currentCat === 'todos' ? MENU : MENU.filter(i => i.cat === currentCat);
  renderMenu(activeItems);
}

function addItemFromModal(id, opt) {
  const cartKey = `${id}-${opt}`;
  cart[cartKey] = (cart[cartKey] || 0) + 1;
  updateAll(id);
  spawnParticle(id);
  const item = MENU.find(i => i.id === id);
  const unitText = item.unitType === 'peso' ? (opt === '0.5kg' ? ' x ½ Kg' : ' x 1 Kg') : '';
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
      const activeItems = currentCat === 'todos' ? MENU : MENU.filter(i => i.cat === currentCat);
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

  const items = cat === 'todos' ? MENU : MENU.filter(i => i.cat === cat);
  const labels = {
    todos: '🍽️ Catálogo Completo',
    'pollo-rebozado': '🍗 Rebozados de Pollo',
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

  const items = MENU.filter(i =>
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

  const opt = item.unitType === 'peso' ? (selectedWeights[id] || '1kg') : 'unidad';
  const cartKey = `${id}-${opt}`;

  cart[cartKey] = (cart[cartKey] || 0) + 1;

  updateAll(id);
  spawnParticle(id);

  const unitText = item.unitType === 'peso' ? (opt === '0.5kg' ? ' x ½ Kg' : ' x 1 Kg') : '';
  showToast(`🍗 ${item.name}${unitText} agregado`);
}



function changeQty(id, delta, event) {
  if (event) event.stopPropagation();

  const item = MENU.find(i => i.id === id);
  if (!item) return;

  const opt = item.unitType === 'peso' ? (selectedWeights[id] || '1kg') : 'unidad';
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
  // Re-renderizamos los controles de la tarjeta afectada en la vista principal
  const item = MENU.find(i => i.id === changedId);
  if (item) {
    const opt = item.unitType === 'peso' ? (selectedWeights[changedId] || '1kg') : 'unidad';
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
      const price = (opt === '0.5kg' && item.priceHalf) ? item.priceHalf : item.price;
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

    const price = (opt === '0.5kg' && item.priceHalf) ? item.priceHalf : item.price;
    
    // Label de la opción seleccionada
    let optionLabel = '';
    if (item.unitType === 'peso') {
      optionLabel = opt === '0.5kg' ? ' x ½ Kg' : ' x 1 Kg';
    } else {
      let unitSuffix = 'Unidad';
      if (item.cat === 'almacen-huevos' && item.id === 45) unitSuffix = 'Docena';
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

  const isFreeShipping = total >= 12000;
  const envio = (deliveryMode === 'delivery' && !isFreeShipping) ? 1000 : 0;
  rows += `<div class="cart-subtotal"><span>Subtotal Productos</span><span>${formatPrice(total)}</span></div>`;
  rows += `<div class="cart-subtotal">
    <span>Envío ${deliveryMode === 'delivery' ? '🛵 (Barrio Norte)' : '🏃 Gratis (retiro local)'}</span>
    <span>${envio ? formatPrice(envio) : (deliveryMode === 'delivery' && isFreeShipping) ? '¡Gratis! 🎉' : '$0'}</span>
  </div>`;
  rows += `<div class="cart-total"><span>Total Final</span><span>${formatPrice(total + envio)}</span></div>`;
  rows += '<div style="height:10px"></div>';

  content.innerHTML = rows;
  form.style.display = 'block';
  document.getElementById('addressSection').style.display = deliveryMode === 'delivery' ? 'block' : 'none';

  // Actualizar los widgets interactivos de la cabecera del carrito
  updateFreeShippingTracker(total);
  checkKiloOptimizer();
}

// ─── DELIVERY MODE ────────────────────────────────────────────────
function setDelivery(mode) {
  deliveryMode = mode;
  document.getElementById('dBtn1').classList.toggle('active', mode === 'delivery');
  document.getElementById('dBtn2').classList.toggle('active', mode === 'takeaway');
  renderCartPanel();
}

// ─── SEND WHATSAPP ORDER ──────────────────────────────────────────
function sendWhatsApp() {
  const nombre = document.getElementById('fNombre').value.trim();
  const tel = document.getElementById('fTel').value.trim();
  const dir = document.getElementById('fDir').value.trim();
  const nota = document.getElementById('fNota').value.trim();

  if (!nombre || !tel) { showToast('⚠️ Completá tu nombre y teléfono'); return; }
  if (deliveryMode === 'delivery' && !dir) { showToast('⚠️ Ingresá tu dirección de entrega'); return; }

  const { total } = getTotals();
  const isFreeShipping = total >= 12000;
  const envio = (deliveryMode === 'delivery' && !isFreeShipping) ? 1000 : 0;
  const waNumber = '549' + WA_NUMBERS[selectedWaIdx]; // Código país + número
  const orderId = generateOrderId();

  let msg = `🐔 *PEDIDO ${orderId} - Punto 25 Delivery* 🐔\n\n`;
  msg += `👤 *Cliente:* ${nombre}\n`;
  msg += `📞 *Teléfono:* ${tel}\n`;
  msg += deliveryMode === 'delivery'
    ? `📍 *Dirección de Entrega:* ${dir}\n`
    : `🏃 *Modalidad:* Retiro en local (Corrientes 664)\n`;
  msg += `\n🛒 *Detalle del Pedido:*\n`;

  // Compilar los items para la generación del ticket digital
  const receiptItems = [];

  Object.entries(cart).forEach(([key, qty]) => {
    const [idStr, opt] = key.split('-');
    const item = MENU.find(i => i.id === parseInt(idStr));
    if (item) {
      const price = (opt === '0.5kg' && item.priceHalf) ? item.priceHalf : item.price;
      
      let optLabel = '';
      if (item.unitType === 'peso') {
        optLabel = opt === '0.5kg' ? ' (½ Kg)' : ' (1 Kg)';
      } else {
        let suffix = 'Unidad';
        if (item.cat === 'almacen-huevos' && item.id === 45) suffix = 'Docena';
        if (item.cat === 'almacen-huevos' && item.id === 46) suffix = 'Bandeja';
        optLabel = ` (${suffix})`;
      }

      msg += `  • ${qty}x ${item.emoji} ${item.name}${optLabel} — ${formatPrice(price * qty)}\n`;
      
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
    msg += `\n🛵 *Envío:* ${envio ? formatPrice(envio) : '¡Gratis! 🎉'}\n`;
  }
  msg += `💰 *TOTAL FINAL: ${formatPrice(total + envio)}*\n`;
  
  if (nota) {
    msg += `\n📝 *Aclaraciones:* ${nota}\n`;
  }
  
  msg += `\n📍 _Enviado desde el catálogo web de Punto 25_`;

  // Guardar datos del cliente de forma permanente
  saveClientData();
  saveLastOrder();

  // Abrir WhatsApp en pestaña nueva
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  
  // Cerrar el panel del carrito
  closeCart();
  
  // Abrir la ventana del ticket de compra digital interactivo en pantalla
  setTimeout(() => {
    openReceiptModal(orderId, nombre, tel, deliveryMode === 'delivery', receiptItems, total, envio);
  }, 400);
  
  showToast(`📲 Pedido ${orderId} enviado a WhatsApp`);
  
  // Refrescar el historial de pedidos anteriores
  setTimeout(checkLastOrderHistory, 1000);
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
  if (promoScroll) {
    promoScroll.addEventListener('scroll', () => {
      const idx = Math.round(promoScroll.scrollLeft / promoScroll.offsetWidth);
      document.querySelectorAll('.promo-dots .dot').forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
    });
  }
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
function init() {
  filterCat('todos');
  initPromoDots();
  initScrollObserver();
  initSpotlightSearch();
  initTheme();
  loadClientData();
  checkLastOrderHistory();
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
function openReceiptModal(orderId, customerName, phone, isDelivery, itemsList, subtotal, shippingCost) {
  const overlay = document.getElementById('receiptOverlay');
  const modal = document.getElementById('receiptModal');
  
  document.getElementById('recId').textContent = orderId;
  
  const now = new Date();
  const dateString = now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + 'hs';
  document.getElementById('recDate').textContent = dateString;
  
  document.getElementById('recName').textContent = customerName;
  document.getElementById('recTel').textContent = phone;
  document.getElementById('recDelivery').textContent = isDelivery ? '🛵 Delivery a Domicilio' : '🏃 Retiro en Local';
  
  // Renderizar ítems como un recibo físico real
  const itemsEl = document.getElementById('recItems');
  itemsEl.innerHTML = itemsList.map(item => `
    <div class="receipt-item-row">
      <span class="receipt-item-name">${item.qty}x ${item.name}${item.optText}</span>
      <span>${formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('');
  
  document.getElementById('recSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('recShipping').textContent = formatPrice(shippingCost);
  document.getElementById('recTotal').textContent = formatPrice(subtotal + shippingCost);
  
  if (overlay && modal) {
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeReceiptModal() {
  const overlay = document.getElementById('receiptOverlay');
  const modal = document.getElementById('receiptModal');
  if (overlay) overlay.classList.remove('open');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  
  // Limpiar y resetear el carrito tras el éxito comercial
  cart = {};
  selectedWeights = {};
  
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
    
    const matches = MENU.filter(item => 
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
  
  let items = [];
  let titleText = '';
  
  if (tag === 'popular') {
    items = MENU.filter(i => i.tags.includes('popular') || i.hot || i.rating >= 4.9);
    titleText = '🔥 Los Más Vendidos del Catálogo';
  } else if (tag === 'relleno') {
    items = MENU.filter(i => i.tags.includes('relleno') || i.name.toLowerCase().includes('rellen') || i.name.toLowerCase().includes('mozzarella'));
    titleText = '🧀 Exquisiteces con Queso & Rellenos';
  } else if (tag === 'saludable') {
    items = MENU.filter(i => i.tags.includes('saludable') || i.cat === 'veggie-soja' || i.tags.includes('vegetariana'));
    titleText = '🥗 Línea Fit & Saludable';
  } else if (tag === 'niños') {
    items = MENU.filter(i => i.tags.includes('niños') || i.name.toLowerCase().includes('patitas') || i.name.toLowerCase().includes('nugget'));
    titleText = '👶 Menú Infantil Favorito';
  }
  
  document.getElementById('menuTitle').textContent = titleText;
  renderMenu(items);
  
  const menuTitleEl = document.getElementById('menuTitle');
  if (menuTitleEl) {
    menuTitleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// 5. MODO OSCURO INTELIGENTE Y AUTOMÁTICO
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  safeStorage.setItem('p25_theme', isDark ? 'dark' : 'light');
  
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
  }
  showToast(isDark ? "🌙 Modo Noche Activado" : "☀️ Modo Día Activado");
}

function initTheme() {
  const savedTheme = safeStorage.getItem('p25_theme');
  const toggleBtn = document.getElementById('themeToggleBtn');
  
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else if (savedTheme === 'light') {
    document.body.classList.remove('dark');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  } else {
    // Si no hay preferencia del cliente, activar modo oscuro inteligente automáticamente según horario (19:30 a 07:00hs)
    const now = new Date();
    const hour = now.getHours();
    const isNightTime = hour >= 19 || hour < 7;
    
    if (isNightTime) {
      document.body.classList.add('dark');
      if (toggleBtn) toggleBtn.textContent = '☀️';
      console.log("Modo oscuro activado automáticamente de forma inteligente por horario nocturno.");
    } else {
      document.body.classList.remove('dark');
      if (toggleBtn) toggleBtn.textContent = '🌙';
    }
  }
}