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
  // Opcional: acción al tocar la tarjeta, en este caso es amigable sumarlo o cambiar foco
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

  document.querySelectorAll('.cat-pill').forEach(p => {
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

  const envio = deliveryMode === 'delivery' ? 1000 : 0; // Envío estimado de $1.000 ARS en Tucumán
  rows += `<div class="cart-subtotal"><span>Subtotal Productos</span><span>${formatPrice(total)}</span></div>`;
  rows += `<div class="cart-subtotal"><span>Envío ${deliveryMode === 'delivery' ? '🛵 (Barrio Norte)' : '🏃 Gratis (retiro local)'}</span><span>${envio ? formatPrice(envio) : '$0'}</span></div>`;
  rows += `<div class="cart-total"><span>Total Final</span><span>${formatPrice(total + envio)}</span></div>`;
  rows += '<div style="height:10px"></div>';

  content.innerHTML = rows;
  form.style.display = 'block';
  document.getElementById('addressSection').style.display = deliveryMode === 'delivery' ? 'block' : 'none';
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
  const envio = deliveryMode === 'delivery' ? 1000 : 0;
  const waNumber = '549' + WA_NUMBERS[selectedWaIdx]; // Código país + número
  const orderId = generateOrderId();

  let msg = `🐔 *PEDIDO ${orderId} - Punto 25 Delivery* 🐔\n\n`;
  msg += `👤 *Cliente:* ${nombre}\n`;
  msg += `📞 *Teléfono:* ${tel}\n`;
  msg += deliveryMode === 'delivery'
    ? `📍 *Dirección de Entrega:* ${dir}\n`
    : `🏃 *Modalidad:* Retiro en local (Corrientes 664)\n`;
  msg += `\n🛒 *Detalle del Pedido:*\n`;

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
    }
  });

  if (deliveryMode === 'delivery') {
    msg += `\n🛵 *Envío:* ${formatPrice(envio)}\n`;
  }
  msg += `💰 *TOTAL FINAL: ${formatPrice(total + envio)}*\n`;
  
  if (nota) {
    msg += `\n📝 *Aclaraciones:* ${nota}\n`;
  }
  
  msg += `\n📍 _Enviado desde el catálogo web de Punto 25_`;

  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  showToast(`📲 Pedido ${orderId} redirigiendo...`);
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
  renderMenu(MENU);
  initPromoDots();
  initScrollObserver();
}

// Iniciar aplicación
init();