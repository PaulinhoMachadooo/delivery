const loginCard = document.getElementById('login-card');
const loginForm = document.getElementById('login-form');
const dashboard = document.getElementById('admin-dashboard');
const logoutButton = document.getElementById('logout-btn');
const merchantTitle = document.getElementById('merchant-title');
const merchantOwner = document.getElementById('merchant-owner');

const merchantForm = document.getElementById('merchant-form');
const menuForm = document.getElementById('menu-form');
const menuList = document.getElementById('menu-list');
const ordersList = document.getElementById('orders-list');
const feedback = document.getElementById('feedback');
const kpiTotal = document.getElementById('kpi-total');
const kpiOpen = document.getElementById('kpi-open');
const kpiDone = document.getElementById('kpi-done');
const kpiCancel = document.getElementById('kpi-cancel');
const dailySales = document.getElementById('daily-sales');
const dailyOrders = document.getElementById('daily-orders');
const topItems = document.getElementById('top-items');

let authToken = localStorage.getItem('admin_token') || '';
let merchant = null;
let menuItems = [];

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? '#b91c1c' : '#166534';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`
  };
}

function setLoggedInUI(profile) {
  loginCard.classList.add('hidden');
  dashboard.classList.remove('hidden');
  merchantTitle.textContent = profile.merchant.name;
  merchantOwner.textContent = `Responsável: ${profile.name} (${profile.email})`;
}

function setLoggedOutUI() {
  dashboard.classList.add('hidden');
  loginCard.classList.remove('hidden');
}

async function fetchMe() {
  const response = await fetch('/api/admin/me', {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  if (!response.ok) {
    throw new Error('Sessão inválida');
  }

  const profile = await response.json();
  merchant = profile.merchant;

  merchantForm.name.value = merchant.name;
  merchantForm.category.value = merchant.category;

  const merchantDetailResponse = await fetch('/api/admin/merchants', {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const [merchantDetail] = await merchantDetailResponse.json();

  merchantForm.delivery_fee.value = merchantDetail.delivery_fee;
  merchantForm.eta_minutes.value = merchantDetail.eta_minutes;
  merchantForm.rating.value = merchantDetail.rating;

  setLoggedInUI(profile);
  await Promise.all([loadMenu(), loadOrders(), loadDashboard()]);
}

async function loadMenu() {
  const response = await fetch(`/api/merchants/${merchant.id}/menu`);
  menuItems = await response.json();

  menuList.innerHTML = menuItems
    .map(
      (item) => `
      <div class="item">
        <strong>${item.name}</strong>
        <small>${item.description}</small>
        <div class="row">
          <span>${money(item.price)}</span>
          <div>
            <button type="button" data-edit-menu="${item.id}">Editar</button>
            <button type="button" data-delete-menu="${item.id}">Excluir</button>
          </div>
        </div>
      </div>`
    )
    .join('');
}

async function loadOrders() {
  const response = await fetch(`/api/admin/merchants/${merchant.id}/orders`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const orders = await response.json();

  ordersList.innerHTML = orders
    .map(
      (order) => `
      <div class="order">
        <strong>Pedido #${order.id}</strong>
        <small>${order.customer_name} • ${money(order.total)}</small>
        <div class="row">
          <span>${order.status}</span>
          <select data-order-status="${order.id}">
            ${['Recebido', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Cancelado']
              .map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`)
              .join('')}
          </select>
        </div>
      </div>`
    )
    .join('');
}


async function loadDashboard() {
  const response = await fetch(`/api/admin/merchants/${merchant.id}/dashboard`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });

  if (!response.ok) {
    return;
  }

  const data = await response.json();
  kpiTotal.textContent = data.counters.total;
  kpiOpen.textContent = data.counters.recebido;
  kpiDone.textContent = data.counters.concluido;
  kpiCancel.textContent = data.counters.cancelado;

  dailySales.textContent = money(data.dailySales.total_sales || 0);
  dailyOrders.textContent = data.dailySales.total_orders || 0;

  if (!data.topItems.length) {
    topItems.innerHTML = '<small>Nenhum item vendido hoje ainda.</small>';
    return;
  }

  topItems.innerHTML = data.topItems
    .map((item) => `<div class="top-item"><span>${item.name}</span><strong>${item.qty} un.</strong></div>`)
    .join('');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: formData.get('email'),
      password: formData.get('password')
    })
  });

  if (!response.ok) {
    showFeedback('Credenciais inválidas.', true);
    return;
  }

  const data = await response.json();
  authToken = data.token;
  localStorage.setItem('admin_token', authToken);
  showFeedback('Login realizado com sucesso.');
  await fetchMe();
});

logoutButton.addEventListener('click', async () => {
  if (authToken) {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
  }

  authToken = '';
  localStorage.removeItem('admin_token');
  merchant = null;
  setLoggedOutUI();
  showFeedback('Sessão encerrada.');
});

merchantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: merchantForm.name.value,
    category: merchantForm.category.value,
    delivery_fee: Number(merchantForm.delivery_fee.value),
    eta_minutes: Number(merchantForm.eta_minutes.value),
    rating: Number(merchantForm.rating.value)
  };

  const response = await fetch(`/api/admin/merchants/${merchant.id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) return showFeedback('Erro ao atualizar comércio.', true);
  showFeedback('Comércio atualizado com sucesso.');
  await fetchMe();
});

menuForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: menuForm.name.value,
    description: menuForm.description.value,
    price: Number(menuForm.price.value)
  };

  const response = await fetch(`/api/admin/merchants/${merchant.id}/menu`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) return showFeedback('Erro ao adicionar item.', true);
  menuForm.reset();
  showFeedback('Item adicionado com sucesso.');
  await Promise.all([loadMenu(), loadDashboard()]);
});

menuList.addEventListener('click', async (event) => {
  const editButton = event.target.closest('button[data-edit-menu]');
  if (editButton) {
    const id = Number(editButton.dataset.editMenu);
    const item = menuItems.find((m) => m.id === id);
    const name = prompt('Nome do item:', item.name);
    const description = prompt('Descrição:', item.description);
    const price = Number(prompt('Preço:', item.price));

    if (!name || !description || Number.isNaN(price)) return;

    const response = await fetch(`/api/admin/menu/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, description, price })
    });

    if (!response.ok) return showFeedback('Erro ao editar item.', true);
    showFeedback('Item atualizado com sucesso.');
    await Promise.all([loadMenu(), loadDashboard()]);
    return;
  }

  const deleteButton = event.target.closest('button[data-delete-menu]');
  if (deleteButton) {
    const id = Number(deleteButton.dataset.deleteMenu);
    const response = await fetch(`/api/admin/menu/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.ok) return showFeedback('Erro ao excluir item.', true);
    showFeedback('Item removido com sucesso.');
    await Promise.all([loadMenu(), loadDashboard()]);
  }
});

ordersList.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-order-status]');
  if (!select) return;

  const orderId = Number(select.dataset.orderStatus);
  const response = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status: select.value })
  });

  if (!response.ok) return showFeedback('Erro ao atualizar status.', true);
  showFeedback('Status do pedido atualizado.');
  await Promise.all([loadOrders(), loadDashboard()]);
});

(async function bootstrap() {
  if (!authToken) {
    setLoggedOutUI();
    return;
  }

  try {
    await fetchMe();
  } catch (error) {
    authToken = '';
    localStorage.removeItem('admin_token');
    setLoggedOutUI();
  }
})();
