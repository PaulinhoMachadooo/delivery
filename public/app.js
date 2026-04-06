const merchantList = document.getElementById('merchant-list');
const menuList = document.getElementById('menu-list');
const cartItems = document.getElementById('cart-items');
const cartSummary = document.getElementById('cart-summary');
const checkoutForm = document.getElementById('checkout-form');
const orderFeedback = document.getElementById('order-feedback');

let merchants = [];
let selectedMerchant = null;
let currentMenu = [];
let cart = [];

const money = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

function showFeedback(message, type = '') {
  orderFeedback.textContent = message;
  orderFeedback.className = `feedback ${type}`;
}

function renderMerchants() {
  merchantList.innerHTML = merchants
    .map(
      (merchant) => `
      <article class="card ${selectedMerchant?.id === merchant.id ? 'active' : ''}">
        <strong>${merchant.name}</strong>
        <span class="small">${merchant.category} • ⭐ ${merchant.rating.toFixed(1)}</span>
        <span class="small">Entrega: ${money(merchant.delivery_fee)} • ${merchant.eta_minutes} min</span>
        <button onclick="selectMerchant(${merchant.id})">Ver cardápio</button>
      </article>`
    )
    .join('');
}

function renderMenu() {
  if (!selectedMerchant) {
    menuList.innerHTML = '<p class="small">Escolha um comércio para visualizar os itens.</p>';
    return;
  }

  menuList.innerHTML = currentMenu
    .map(
      (item) => `
      <article class="card">
        <strong>${item.name}</strong>
        <span class="small">${item.description}</span>
        <span class="price">${money(item.price)}</span>
        <button onclick="addToCart(${item.id})">Adicionar</button>
      </article>`
    )
    .join('');
}

function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="small">Nenhum item no carrinho.</p>';
    cartSummary.innerHTML = '<p>Selecione itens para continuar.</p>';
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item) => `
      <div class="cart-item">
        <span>${item.name} x${item.quantity}</span>
        <span>${money(item.price * item.quantity)}</span>
      </div>`
    )
    .join('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = selectedMerchant.delivery_fee;
  const total = subtotal + deliveryFee;

  cartSummary.innerHTML = `
    <div class="cart-item"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="cart-item"><span>Entrega</span><span>${money(deliveryFee)}</span></div>
    <div class="cart-item"><strong>Total</strong><strong>${money(total)}</strong></div>
  `;
}

async function loadMerchants() {
  const response = await fetch('/api/merchants');
  merchants = await response.json();
  renderMerchants();
}

async function selectMerchant(merchantId) {
  selectedMerchant = merchants.find((merchant) => merchant.id === merchantId);
  cart = [];
  showFeedback('');
  renderMerchants();
  renderCart();

  const response = await fetch(`/api/merchants/${merchantId}/menu`);
  currentMenu = await response.json();
  renderMenu();
}
window.selectMerchant = selectMerchant;

function addToCart(menuItemId) {
  const selectedItem = currentMenu.find((item) => item.id === menuItemId);
  const cartItem = cart.find((item) => item.id === menuItemId);

  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({
      id: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity: 1
    });
  }

  renderCart();
}
window.addToCart = addToCart;

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedMerchant) {
    showFeedback('Escolha um comércio antes de finalizar.', 'error');
    return;
  }

  if (cart.length === 0) {
    showFeedback('Adicione itens no carrinho antes de finalizar.', 'error');
    return;
  }

  const formData = new FormData(checkoutForm);
  const payload = {
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    address: formData.get('address'),
    merchantId: selectedMerchant.id,
    items: cart.map((item) => ({
      menuItemId: item.id,
      quantity: item.quantity
    }))
  };

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    showFeedback(data.message || 'Não foi possível criar o pedido.', 'error');
    return;
  }

  showFeedback(
    `Pedido #${data.orderId} confirmado! Status: ${data.status}. Previsão: ${data.etaMinutes} min.`,
    'ok'
  );

  cart = [];
  renderCart();
  checkoutForm.reset();
});

loadMerchants();
renderMenu();
renderCart();
