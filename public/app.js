const merchantList = document.getElementById('merchant-list');
const menuList = document.getElementById('menu-list');
const cartItems = document.getElementById('cart-items');
const cartSummary = document.getElementById('cart-summary');
const checkoutForm = document.getElementById('checkout-form');
const orderFeedback = document.getElementById('order-feedback');
const searchInput = document.getElementById('search-input');
const categoryChips = document.getElementById('category-chips');
const merchantCount = document.getElementById('merchant-count');
const menuTitle = document.getElementById('menu-title');
const menuHint = document.getElementById('menu-hint');

let merchants = [];
let filteredMerchants = [];
let selectedMerchant = null;
let currentMenu = [];
let cart = [];
let activeCategory = 'Todos';

const categoryMeta = {
  Todos: { icon: '🍽️', label: 'Todos' },
  Pizza: { icon: '🍕', label: 'Pizzas' },
  Hambúrguer: { icon: '🍔', label: 'Lanches' },
  Japonês: { icon: '🍣', label: 'Japonesa' }
};

const merchantImages = {
  Pizza: 'https://source.unsplash.com/900x600/?pizzeria,pizza,restaurant',
  Japonês: 'https://source.unsplash.com/900x600/?sushi,restaurant,japanese-food',
  Hambúrguer: 'https://source.unsplash.com/900x600/?burger,fries,restaurant'
};

const menuImagesByKeyword = [
  { match: ['pizza', 'calabresa', 'margherita'], image: 'https://source.unsplash.com/800x500/?pizza,pepperoni' },
  { match: ['refrigerante'], image: 'https://source.unsplash.com/800x500/?soda,cold-drink' },
  { match: ['sushi', 'combinado', 'temaki'], image: 'https://source.unsplash.com/800x500/?sushi,sashimi' },
  { match: ['yakissoba'], image: 'https://source.unsplash.com/800x500/?yakisoba,noodles' },
  { match: ['burger', 'hambúrguer', 'bacon'], image: 'https://source.unsplash.com/800x500/?cheeseburger,bacon' },
  { match: ['batata'], image: 'https://source.unsplash.com/800x500/?french-fries,potato' }
];

function getMerchantImage(category) {
  return merchantImages[category] || 'https://source.unsplash.com/900x600/?food,restaurant';
}

function getMenuItemImage(itemName = '') {
  const normalized = itemName.toLowerCase();
  const match = menuImagesByKeyword.find((rule) =>
    rule.match.some((term) => normalized.includes(term))
  );

  if (match) {
    return match.image;
  }

  return 'https://source.unsplash.com/800x500/?food,dish';
}

const money = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

function showFeedback(message, type = '') {
  orderFeedback.textContent = message;
  orderFeedback.className = `feedback ${type}`;
}

function renderCategories() {
  const categories = ['Todos', ...new Set(merchants.map((merchant) => merchant.category))];
  categoryChips.innerHTML = categories
    .map((category) => {
      const meta = categoryMeta[category] || { icon: '🍴', label: category };
      return `
        <button type="button" class="chip cat-pill ${activeCategory === category ? 'active' : ''}" data-category="${category}">
          <span class="cat-icon" aria-hidden="true">${meta.icon}</span>
          <span>${meta.label}</span>
        </button>`;
    })
    .join('');
}

function applyMerchantFilters() {
  const query = searchInput.value.trim().toLowerCase();

  filteredMerchants = merchants.filter((merchant) => {
    const categoryMatch = activeCategory === 'Todos' || merchant.category === activeCategory;
    const text = `${merchant.name} ${merchant.category}`.toLowerCase();
    const textMatch = !query || text.includes(query);
    return categoryMatch && textMatch;
  });

  merchantCount.textContent = `${filteredMerchants.length} encontrados`;
}

function renderMerchants() {
  applyMerchantFilters();

  if (filteredMerchants.length === 0) {
    merchantList.innerHTML = '<div class="empty">Nenhum restaurante encontrado com esses filtros.</div>';
    return;
  }

  merchantList.innerHTML = filteredMerchants
    .map(
      (merchant) => `
      <article class="card merchant-card ${selectedMerchant?.id === merchant.id ? 'active' : ''}">
        <img class="merchant-cover" src="${getMerchantImage(merchant.category)}" alt="Imagem de ${merchant.category}" loading="lazy" />
        <strong>${merchant.name}</strong>
        <span class="meta">${merchant.category} • ⭐ ${merchant.rating.toFixed(1)}</span>
        <span class="meta">Entrega ${money(merchant.delivery_fee)} • ${merchant.eta_minutes} min</span>
        <div class="card-footer">
          <span class="meta">Pedido mínimo flexível</span>
          <button type="button" class="add-btn" data-select-merchant="${merchant.id}">Ver cardápio</button>
        </div>
      </article>`
    )
    .join('');
}

function renderMenu() {
  if (!selectedMerchant) {
    menuList.innerHTML = '<div class="empty">Escolha um restaurante para ver os pratos.</div>';
    menuTitle.textContent = 'Cardápio';
    menuHint.textContent = 'Selecione um restaurante para começar.';
    return;
  }

  menuTitle.textContent = `Cardápio • ${selectedMerchant.name}`;
  menuHint.textContent = `${selectedMerchant.eta_minutes} min • Entrega ${money(selectedMerchant.delivery_fee)}`;

  menuList.innerHTML = currentMenu
    .map(
      (item) => `
      <article class="card menu-card">
        <img class="dish-cover" src="${getMenuItemImage(item.name)}" alt="Foto ilustrativa de ${item.name}" loading="lazy" />
        <strong>${item.name}</strong>
        <span class="meta">${item.description}</span>
        <div class="card-footer">
          <span class="price">${money(item.price)}</span>
          <button type="button" class="add-btn" data-add-item="${item.id}">Adicionar</button>
        </div>
      </article>`
    )
    .join('');
}

function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="muted">Seu carrinho está vazio.</p>';
    cartSummary.innerHTML = '<p class="muted">Adicione itens para continuar.</p>';
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item) => `
      <div class="cart-item">
        <div>
          <strong>${item.name}</strong>
          <div class="meta">${money(item.price)} cada</div>
          <div class="qty-actions">
            <button type="button" class="qty-btn" data-dec-item="${item.id}">-</button>
            <span>${item.quantity}</span>
            <button type="button" class="qty-btn" data-inc-item="${item.id}">+</button>
          </div>
        </div>
        <strong>${money(item.price * item.quantity)}</strong>
      </div>`
    )
    .join('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = selectedMerchant.delivery_fee;
  const total = subtotal + deliveryFee;

  cartSummary.innerHTML = `
    <div class="cart-item"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="cart-item"><span>Taxa de entrega</span><span>${money(deliveryFee)}</span></div>
    <div class="cart-item"><strong>Total</strong><strong>${money(total)}</strong></div>
  `;
}

async function loadMerchants() {
  const response = await fetch('/api/merchants');
  merchants = await response.json();
  renderCategories();
  renderMerchants();
}

async function selectMerchant(merchantId) {
  selectedMerchant = merchants.find((merchant) => merchant.id === Number(merchantId));
  cart = [];
  showFeedback('');
  renderMerchants();
  renderCart();

  const response = await fetch(`/api/merchants/${merchantId}/menu`);
  currentMenu = await response.json();
  renderMenu();
}

function addToCart(menuItemId) {
  const selectedItem = currentMenu.find((item) => item.id === Number(menuItemId));
  const existing = cart.find((item) => item.id === Number(menuItemId));

  if (!selectedItem) {
    return;
  }

  if (existing) {
    existing.quantity += 1;
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

function updateQuantity(menuItemId, delta) {
  const target = cart.find((item) => item.id === Number(menuItemId));
  if (!target) {
    return;
  }

  target.quantity += delta;
  if (target.quantity <= 0) {
    cart = cart.filter((item) => item.id !== Number(menuItemId));
  }
  renderCart();
}

merchantList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-select-merchant]');
  if (button) {
    selectMerchant(button.dataset.selectMerchant);
  }
});

menuList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-add-item]');
  if (button) {
    addToCart(button.dataset.addItem);
  }
});

cartItems.addEventListener('click', (event) => {
  const inc = event.target.closest('button[data-inc-item]');
  if (inc) {
    updateQuantity(inc.dataset.incItem, 1);
    return;
  }

  const dec = event.target.closest('button[data-dec-item]');
  if (dec) {
    updateQuantity(dec.dataset.decItem, -1);
  }
});

categoryChips.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-category]');
  if (!chip) {
    return;
  }

  activeCategory = chip.dataset.category;
  renderCategories();
  renderMerchants();
});

searchInput.addEventListener('input', () => {
  renderMerchants();
});

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedMerchant) {
    showFeedback('Escolha um restaurante antes de finalizar.', 'error');
    return;
  }

  if (cart.length === 0) {
    showFeedback('Adicione itens ao carrinho antes de finalizar.', 'error');
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

  showFeedback(`Pedido #${data.orderId} confirmado! Previsão: ${data.etaMinutes} min.`, 'ok');
  cart = [];
  renderCart();
  checkoutForm.reset();
});

loadMerchants();
renderMenu();
renderCart();
