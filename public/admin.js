const merchantSelect = document.getElementById('merchant-select');
const merchantForm = document.getElementById('merchant-form');
const menuForm = document.getElementById('menu-form');
const menuList = document.getElementById('menu-list');
const ordersList = document.getElementById('orders-list');
const feedback = document.getElementById('feedback');

let merchants = [];
let selectedMerchantId = null;
let menuItems = [];

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function showFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? '#b91c1c' : '#166534';
}

async function loadMerchants() {
  const response = await fetch('/api/admin/merchants');
  merchants = await response.json();

  merchantSelect.innerHTML = merchants.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');

  if (merchants.length > 0) {
    selectedMerchantId = Number(merchantSelect.value);
    fillMerchantForm();
    await Promise.all([loadMenu(), loadOrders()]);
  }
}

function fillMerchantForm() {
  const merchant = merchants.find((m) => m.id === selectedMerchantId);
  if (!merchant) return;
  merchantForm.name.value = merchant.name;
  merchantForm.category.value = merchant.category;
  merchantForm.delivery_fee.value = merchant.delivery_fee;
  merchantForm.eta_minutes.value = merchant.eta_minutes;
  merchantForm.rating.value = merchant.rating;
}

async function loadMenu() {
  const response = await fetch(`/api/merchants/${selectedMerchantId}/menu`);
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
  const response = await fetch(`/api/admin/merchants/${selectedMerchantId}/orders`);
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

merchantSelect.addEventListener('change', async () => {
  selectedMerchantId = Number(merchantSelect.value);
  fillMerchantForm();
  await Promise.all([loadMenu(), loadOrders()]);
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

  const response = await fetch(`/api/admin/merchants/${selectedMerchantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) return showFeedback('Erro ao atualizar comércio.', true);
  showFeedback('Comércio atualizado com sucesso.');
  await loadMerchants();
});

menuForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: menuForm.name.value,
    description: menuForm.description.value,
    price: Number(menuForm.price.value)
  };

  const response = await fetch(`/api/admin/merchants/${selectedMerchantId}/menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) return showFeedback('Erro ao adicionar item.', true);
  menuForm.reset();
  showFeedback('Item adicionado com sucesso.');
  await loadMenu();
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, price })
    });

    if (!response.ok) return showFeedback('Erro ao editar item.', true);
    showFeedback('Item atualizado com sucesso.');
    await loadMenu();
    return;
  }

  const deleteButton = event.target.closest('button[data-delete-menu]');
  if (deleteButton) {
    const id = Number(deleteButton.dataset.deleteMenu);
    const response = await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });

    if (!response.ok) return showFeedback('Erro ao excluir item.', true);
    showFeedback('Item removido com sucesso.');
    await loadMenu();
  }
});

ordersList.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-order-status]');
  if (!select) return;

  const orderId = Number(select.dataset.orderStatus);
  const response = await fetch(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: select.value })
  });

  if (!response.ok) return showFeedback('Erro ao atualizar status.', true);
  showFeedback('Status do pedido atualizado.');
  await loadOrders();
});

loadMerchants();
