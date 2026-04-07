const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'delivery.db');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

async function setupDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      delivery_fee REAL NOT NULL,
      eta_minutes INTEGER NOT NULL,
      rating REAL NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      address TEXT NOT NULL,
      merchant_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      total REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )
  `);

  const [{ count }] = await all('SELECT COUNT(*) AS count FROM merchants');

  if (count === 0) {
    const seedMerchants = [
      ['Pizzaria Bella Massa', 'Pizza', 6.9, 35, 4.8],
      ['Sushi Centro', 'Japonês', 8.5, 45, 4.7],
      ['Burguer da Praça', 'Hambúrguer', 5.9, 30, 4.6]
    ];

    for (const merchant of seedMerchants) {
      await run(
        'INSERT INTO merchants (name, category, delivery_fee, eta_minutes, rating) VALUES (?, ?, ?, ?, ?)',
        merchant
      );
    }

    const seedMenuItems = [
      [1, 'Pizza Margherita', 'Molho de tomate, mussarela e manjericão fresco.', 49.9],
      [1, 'Pizza Calabresa', 'Calabresa artesanal, cebola roxa e azeitonas.', 55.9],
      [1, 'Refrigerante 2L', 'Escolha entre cola, laranja ou guaraná.', 12],
      [2, 'Combinado 20 peças', 'Sashimi, nigiri e uramaki selecionados.', 69.9],
      [2, 'Temaki Salmão', 'Temaki grande com cream cheese e cebolinha.', 28.9],
      [2, 'Yakissoba Frango', 'Macarrão oriental com legumes e frango.', 35.5],
      [3, 'Burger Clássico', 'Pão brioche, carne 160g, queijo e molho da casa.', 29.9],
      [3, 'Burger Duplo Bacon', 'Dois blends 120g, cheddar e bacon crocante.', 39.9],
      [3, 'Batata Rústica', 'Porção de batata rústica com páprica defumada.', 19.9]
    ];

    for (const menuItem of seedMenuItems) {
      await run(
        'INSERT INTO menu_items (merchant_id, name, description, price) VALUES (?, ?, ?, ?)',
        menuItem
      );
    }
  }
}

app.get('/api/merchants', async (_, res) => {
  try {
    const merchants = await all('SELECT * FROM merchants ORDER BY rating DESC');
    res.json(merchants);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar comércios.' });
  }
});

app.get('/api/merchants/:merchantId/menu', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const menu = await all(
      'SELECT * FROM menu_items WHERE merchant_id = ? ORDER BY name',
      [merchantId]
    );
    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar cardápio.' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { customerName, customerPhone, address, merchantId, items } = req.body;

  if (!customerName || !customerPhone || !address || !merchantId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Dados do pedido inválidos.' });
  }

  try {
    const merchant = await get('SELECT * FROM merchants WHERE id = ?', [merchantId]);
    if (!merchant) {
      return res.status(404).json({ message: 'Comércio não encontrado.' });
    }

    const menuIds = items.map((item) => item.menuItemId);
    const placeholders = menuIds.map(() => '?').join(',');
    const menuItems = await all(
      `SELECT id, price, name FROM menu_items WHERE merchant_id = ? AND id IN (${placeholders})`,
      [merchantId, ...menuIds]
    );

    if (menuItems.length !== menuIds.length) {
      return res.status(400).json({ message: 'Itens do pedido inválidos para este comércio.' });
    }

    const priceById = new Map(menuItems.map((item) => [item.id, item]));
    let subtotal = 0;

    for (const item of items) {
      const menuItem = priceById.get(item.menuItemId);
      if (!menuItem || item.quantity < 1) {
        return res.status(400).json({ message: 'Quantidade inválida.' });
      }
      subtotal += menuItem.price * item.quantity;
    }

    const deliveryFee = merchant.delivery_fee;
    const total = subtotal + deliveryFee;
    const createdAt = new Date().toISOString();

    const orderResult = await run(
      `INSERT INTO orders (
        customer_name,
        customer_phone,
        address,
        merchant_id,
        status,
        subtotal,
        delivery_fee,
        total,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerName, customerPhone, address, merchantId, 'Recebido', subtotal, deliveryFee, total, createdAt]
    );

    for (const item of items) {
      const menuItem = priceById.get(item.menuItemId);
      await run(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderResult.id, item.menuItemId, item.quantity, menuItem.price]
      );
    }

    return res.status(201).json({
      orderId: orderResult.id,
      status: 'Recebido',
      etaMinutes: merchant.eta_minutes,
      total
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar pedido.' });
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await get(
      `SELECT o.*, m.name AS merchant_name, m.eta_minutes
       FROM orders o
       JOIN merchants m ON m.id = o.merchant_id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    const items = await all(
      `SELECT oi.quantity, oi.unit_price, mi.name
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    return res.json({ ...order, items });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao buscar pedido.' });
  }
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setupDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao inicializar o banco de dados:', error);
    process.exit(1);
  });
