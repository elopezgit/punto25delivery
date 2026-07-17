/**
 * Nexus CRM - Agency Logic
 */

// --- DATA MODELS & STORAGE ---
let clients = [];
let projects = [];
let billing = [];
let revenueChart = null;
let statusChart = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check login
  const isLogged = sessionStorage.getItem("nexus_admin_logged") === "true";
  if (isLogged) {
    document.getElementById("loginOverlay").classList.add("hidden");
    initDashboard();
  }

  // Bind Enter key
  document.getElementById("passwordInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") validateLogin();
  });

  // Init Theme
  const isDark = localStorage.getItem('nexus_theme') === 'dark';
  if (isDark) document.body.classList.add('dark');
  
  updateDateText();
});

function updateDateText() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("currentDateText").textContent = new Date().toLocaleDateString('es-AR', options).replace(/^\w/, c => c.toUpperCase());
}

// --- AUTH ---
function validateLogin() {
  console.log("validateLogin called");
  const user = document.getElementById("usernameInput").value.trim();
  const pass = document.getElementById("passwordInput").value.trim();
  const err = document.getElementById("loginError");

  if (user.toLowerCase() === "admin" && pass === "123456") {
    sessionStorage.setItem("nexus_admin_logged", "true");
    document.getElementById("loginOverlay").classList.add("hidden");
    initDashboard();
  } else {
    err.style.display = "block";
    setTimeout(() => err.style.display = "none", 3000);
  }
}

function logout() {
  sessionStorage.removeItem("nexus_admin_logged");
  location.reload();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('nexus_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  if (revenueChart) revenueChart.update();
  if (statusChart) statusChart.update();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`view-${viewId}`).classList.add('active');
  document.getElementById(`nav-${viewId}`).classList.add('active');
  
  document.getElementById('sidebar').classList.remove('open'); // close on mobile
  
  if (viewId === 'dashboard') updateDashboard();
  if (viewId === 'clients') renderClients();
  if (viewId === 'projects') renderProjects();
  if (viewId === 'billing') renderBilling();
}

// --- MODALS ---
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'projectModal') updateClientSelects();
  if (id === 'billingModal') updateProjectSelects();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// --- DATA MANAGEMENT ---
function initDashboard() {
  loadData();
  switchView('dashboard');
}

function loadData() {
  const c = localStorage.getItem('nexus_clients');
  const p = localStorage.getItem('nexus_projects');
  const b = localStorage.getItem('nexus_billing');
  
  if (c) clients = JSON.parse(c);
  if (p) projects = JSON.parse(p);
  if (b) billing = JSON.parse(b);
  
  if (!c && !p && !b) generateMockData();
  
  updateDashboard();
}

function saveData() {
  localStorage.setItem('nexus_clients', JSON.stringify(clients));
  localStorage.setItem('nexus_projects', JSON.stringify(projects));
  localStorage.setItem('nexus_billing', JSON.stringify(billing));
  updateDashboard();
}

function generateMockData() {
  clients = [
    { id: 'c1', name: 'Acme Corp', contact: 'Juan Pérez', phone: '+5491112345678' },
    { id: 'c2', name: 'Global Tech', contact: 'María García', phone: '+5491123456789' }
  ];
  
  projects = [
    { id: 'p1', clientId: 'c1', name: 'Sitio Web Institucional', url: 'https://acme.com', user: 'admin', pass: 'Acme2026!', status: 'Activo' },
    { id: 'p2', clientId: 'c2', name: 'E-commerce App', url: 'https://globaltech.com', user: 'dev', pass: 'GlobalTech#', status: 'En Desarrollo' }
  ];
  
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
  
  billing = [
    { id: 'b1', projectId: 'p1', amount: 50000, date: today, status: 'Pagado' },
    { id: 'b2', projectId: 'p2', amount: 150000, date: today, status: 'Pendiente' },
    { id: 'b3', projectId: 'p1', amount: 40000, date: lastMonth, status: 'Pagado' }
  ];
  
  saveData();
  alert('Datos de prueba generados correctamente.');
}

// --- DASHBOARD ---
function updateDashboard() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  let totalRevenue = 0;
  let totalPending = 0;
  
  billing.forEach(b => {
    const bDate = new Date(b.date);
    if (bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear) {
      if (b.status === 'Pagado') totalRevenue += Number(b.amount);
    }
    if (b.status === 'Pendiente') totalPending += Number(b.amount);
  });
  
  const activeProjects = projects.filter(p => p.status === 'Activo').length;
  
  document.getElementById('kpiRevenue').textContent = '$' + totalRevenue.toLocaleString('es-AR');
  document.getElementById('kpiPending').textContent = '$' + totalPending.toLocaleString('es-AR');
  document.getElementById('kpiProjects').textContent = activeProjects;
  document.getElementById('kpiClients').textContent = clients.length;
  
  renderCharts();
}

// --- CHARTS ---
function renderCharts() {
  const getCssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
  
  // 1. Revenue Chart (Last 6 Months)
  const ctxRev = document.getElementById('revenueChart');
  if (revenueChart) revenueChart.destroy();
  
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const last6Months = [];
  const revenueData = [];
  const pendingData = [];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6Months.push(monthNames[d.getMonth()]);
    
    let monthRev = 0;
    let monthPend = 0;
    billing.forEach(b => {
      const bDate = new Date(b.date + 'T12:00:00Z');
      if (bDate.getMonth() === d.getMonth() && bDate.getFullYear() === d.getFullYear()) {
        if (b.status === 'Pagado') monthRev += Number(b.amount);
        if (b.status === 'Pendiente') monthPend += Number(b.amount);
      }
    });
    revenueData.push(monthRev);
    pendingData.push(monthPend);
  }
  
  revenueChart = new Chart(ctxRev, {
    type: 'bar',
    data: {
      labels: last6Months,
      datasets: [
        { label: 'Facturado ($)', data: revenueData, backgroundColor: getCssVar('--brand'), borderRadius: 6 },
        { label: 'Pendiente ($)', data: pendingData, backgroundColor: getCssVar('--gold'), borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: getCssVar('--border') }, ticks: { color: getCssVar('--text-light') } },
        x: { grid: { display: false }, ticks: { color: getCssVar('--text-light') } }
      },
      plugins: { legend: { labels: { color: getCssVar('--text') } } }
    }
  });

  // 2. Status Chart (Distribution by Client)
  const ctxStatus = document.getElementById('statusChart');
  if (statusChart) statusChart.destroy();
  
  const clientRevenue = {};
  clients.forEach(c => clientRevenue[c.name] = 0);
  
  billing.forEach(b => {
    if (b.status === 'Pagado') {
      const proj = projects.find(p => p.id === b.projectId);
      if (proj) {
        const client = clients.find(c => c.id === proj.clientId);
        if (client) clientRevenue[client.name] += Number(b.amount);
      }
    }
  });
  
  const clientNames = Object.keys(clientRevenue).filter(k => clientRevenue[k] > 0);
  const clientData = clientNames.map(k => clientRevenue[k]);
  
  statusChart = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: clientNames,
      datasets: [{
        data: clientData,
        backgroundColor: [getCssVar('--brand'), getCssVar('--blue'), getCssVar('--gold'), getCssVar('--green'), getCssVar('--brand2')],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: getCssVar('--text') } } }
    }
  });
}

// --- CLIENTS ---
function renderClients() {
  const query = document.getElementById('clientSearch').value.toLowerCase();
  const tbody = document.getElementById('clientsTableBody');
  tbody.innerHTML = '';
  
  clients.filter(c => c.name.toLowerCase().includes(query) || c.contact.toLowerCase().includes(query)).forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td data-label="ID">${c.id}</td>
        <td data-label="Empresa"><strong>${c.name}</strong></td>
        <td data-label="Contacto">${c.contact}</td>
        <td data-label="Teléfono">${c.phone}</td>
        <td data-label="Acciones">
          <button class="action-btn" onclick="deleteClient('${c.id}')">❌</button>
        </td>
      </tr>
    `;
  });
}

function saveClient() {
  const name = document.getElementById('newClientName').value.trim();
  const contact = document.getElementById('newClientContact').value.trim();
  const phone = document.getElementById('newClientPhone').value.trim();
  
  if (!name) return alert('La empresa es requerida');
  
  clients.push({ id: 'c' + Date.now(), name, contact, phone });
  saveData();
  closeModal('clientModal');
  
  document.getElementById('newClientName').value = '';
  document.getElementById('newClientContact').value = '';
  document.getElementById('newClientPhone').value = '';
  
  renderClients();
}

function deleteClient(id) {
  if (confirm('¿Eliminar cliente? Se perderán sus proyectos y cobros.')) {
    clients = clients.filter(c => c.id !== id);
    const pIds = projects.filter(p => p.clientId === id).map(p => p.id);
    projects = projects.filter(p => p.clientId !== id);
    billing = billing.filter(b => !pIds.includes(b.projectId));
    saveData();
    renderClients();
  }
}

// --- PROJECTS ---
function updateClientSelects() {
  const sel1 = document.getElementById('newProjectClient');
  const sel2 = document.getElementById('projectClientFilter');
  const sel3 = document.getElementById('billClientFilter');
  
  let opts = '<option value="all">Todos los Clientes</option>';
  let optsNew = '<option value="">Seleccione un cliente...</option>';
  
  clients.forEach(c => {
    const o = `<option value="${c.id}">${c.name}</option>`;
    opts += o;
    optsNew += o;
  });
  
  if (sel1) sel1.innerHTML = optsNew;
  if (sel2 && sel2.value === 'all') sel2.innerHTML = opts;
  if (sel3 && sel3.value === 'all') sel3.innerHTML = opts;
}

function renderProjects() {
  updateClientSelects();
  const clientId = document.getElementById('projectClientFilter').value;
  const tbody = document.getElementById('projectsTableBody');
  tbody.innerHTML = '';
  
  const filtered = clientId === 'all' ? projects : projects.filter(p => p.clientId === clientId);
  
  filtered.forEach(p => {
    const c = clients.find(c => c.id === p.clientId);
    const cName = c ? c.name : 'Desconocido';
    const badgeClass = p.status === 'Activo' ? 'badge-active' : (p.status === 'Baja' ? 'badge-paid' : 'badge-pending');
    
    tbody.innerHTML += `
      <tr>
        <td data-label="Proyecto"><strong>${p.name}</strong></td>
        <td data-label="Cliente">${cName}</td>
        <td data-label="URL"><a href="${p.url}" target="_blank" style="color:var(--brand);">${p.url}</a></td>
        <td data-label="Credenciales">
          <div style="font-size:13px;"><strong>U:</strong> ${p.user}</div>
          <div style="font-size:13px; font-family:monospace; margin-top:4px;"><strong>P:</strong> ${p.pass}</div>
        </td>
        <td data-label="Estado"><span class="badge ${badgeClass}">${p.status}</span></td>
        <td data-label="Acciones">
          <button class="action-btn" onclick="deleteProject('${p.id}')">❌</button>
        </td>
      </tr>
    `;
  });
}

function saveProject() {
  const clientId = document.getElementById('newProjectClient').value;
  const name = document.getElementById('newProjectName').value.trim();
  const url = document.getElementById('newProjectUrl').value.trim();
  const user = document.getElementById('newProjectUser').value.trim();
  const pass = document.getElementById('newProjectPass').value.trim();
  const status = document.getElementById('newProjectStatus').value;
  
  if (!clientId || !name) return alert('Cliente y Nombre son requeridos');
  
  projects.push({ id: 'p' + Date.now(), clientId, name, url, user, pass, status });
  saveData();
  closeModal('projectModal');
  
  document.getElementById('newProjectName').value = '';
  document.getElementById('newProjectUrl').value = '';
  document.getElementById('newProjectUser').value = '';
  document.getElementById('newProjectPass').value = '';
  
  renderProjects();
}

function deleteProject(id) {
  if (confirm('¿Eliminar proyecto y sus cobros asociados?')) {
    projects = projects.filter(p => p.id !== id);
    billing = billing.filter(b => b.projectId !== id);
    saveData();
    renderProjects();
  }
}

// --- BILLING ---
function updateProjectSelects() {
  const sel = document.getElementById('newBillProject');
  let opts = '<option value="">Seleccione un proyecto...</option>';
  
  projects.forEach(p => {
    const c = clients.find(c => c.id === p.clientId);
    const cName = c ? c.name : '';
    opts += `<option value="${p.id}">${cName} - ${p.name}</option>`;
  });
  
  if (sel) sel.innerHTML = opts;
}

function renderBilling() {
  updateClientSelects();
  
  const dFrom = document.getElementById('billDateFrom').value;
  const dTo = document.getElementById('billDateTo').value;
  const cFilter = document.getElementById('billClientFilter').value;
  const sFilter = document.getElementById('billStatusFilter').value;
  
  const tbody = document.getElementById('billingTableBody');
  tbody.innerHTML = '';
  
  // Sort newest first
  let filtered = [...billing].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  filtered = filtered.filter(b => {
    const p = projects.find(proj => proj.id === b.projectId);
    if (!p) return false;
    
    // Client filter
    if (cFilter !== 'all' && p.clientId !== cFilter) return false;
    // Status filter
    if (sFilter !== 'all' && b.status !== sFilter) return false;
    // Date filter
    if (dFrom && b.date < dFrom) return false;
    if (dTo && b.date > dTo) return false;
    
    return true;
  });
  
  filtered.forEach(b => {
    const p = projects.find(proj => proj.id === b.projectId);
    const c = clients.find(cl => cl.id === p.clientId);
    
    const badgeClass = b.status === 'Pagado' ? 'badge-paid' : 'badge-pending';
    
    tbody.innerHTML += `
      <tr>
        <td data-label="ID Cobro">#${b.id.replace('b','')}</td>
        <td data-label="Fecha">${new Date(b.date + 'T12:00:00Z').toLocaleDateString('es-AR')}</td>
        <td data-label="Cliente/Proyecto">
          <strong>${c.name}</strong><br>
          <span style="font-size:12px; color:var(--text-light);">${p.name}</span>
        </td>
        <td data-label="Monto" style="font-weight:900; color:var(--brand);">$${Number(b.amount).toLocaleString('es-AR')}</td>
        <td data-label="Estado"><span class="badge ${badgeClass}">${b.status}</span></td>
        <td data-label="Acciones">
          ${b.status === 'Pendiente' ? `<button class="action-btn" onclick="markPaid('${b.id}')">✅ Pagar</button>` : ''}
          <button class="action-btn" onclick="deleteBill('${b.id}')">❌</button>
        </td>
      </tr>
    `;
  });
}

function saveBill() {
  const projectId = document.getElementById('newBillProject').value;
  const amount = document.getElementById('newBillAmount').value;
  const date = document.getElementById('newBillDate').value;
  const status = document.getElementById('newBillStatus').value;
  
  if (!projectId || !amount || !date) return alert('Todos los campos son requeridos');
  
  billing.push({ id: 'b' + Date.now(), projectId, amount: Number(amount), date, status });
  saveData();
  closeModal('billingModal');
  
  document.getElementById('newBillAmount').value = '';
  document.getElementById('newBillDate').value = '';
  
  renderBilling();
}

function markPaid(id) {
  const b = billing.find(b => b.id === id);
  if (b) {
    b.status = 'Pagado';
    saveData();
    renderBilling();
  }
}

function deleteBill(id) {
  if (confirm('¿Eliminar registro de cobro?')) {
    billing = billing.filter(b => b.id !== id);
    saveData();
    renderBilling();
  }
}
