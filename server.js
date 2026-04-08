const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'delivery.db');
const db = new sqlite3.Database(dbPath);

const adminSessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, {
    userId: user.id,
    merchantId: user.merchant_id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const session = adminSessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    if (token) {
      adminSessions.delete(token);
    }
    return res.status(401).json({ message: 'Não autorizado.' });
  }

  req.admin = session;
  return next();
}

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

  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
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

  const [{ userCount }] = await all('SELECT COUNT(*) AS userCount FROM restaurant_users');
  if (userCount === 0) {
    const userSeeds = [
      { merchantId: 1, name: 'Gerente Bella Massa', email: 'bella@entregacerta.com', password: 'Bella@123' },
      { merchantId: 2, name: 'Gerente Sushi Centro', email: 'sushi@entregacerta.com', password: 'Sushi@123' },
      { merchantId: 3, name: 'Gerente Burguer da Praça', email: 'burger@entregacerta.com', password: 'Burger@123' }
    ];

    for (const user of userSeeds) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(user.password, salt);
      await run(
        `INSERT INTO restaurant_users (merchant_id, name, email, password_salt, password_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [user.merchantId, user.name, user.email, salt, hash]
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




app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' });
  }

  try {
    const user = await get('SELECT * FROM restaurant_users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const computedHash = hashPassword(password, user.password_salt);
    if (computedHash !== user.password_hash) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const merchant = await get('SELECT id, name, category FROM merchants WHERE id = ?', [user.merchant_id]);
    const token = createSession(user);

    return res.json({
      token,
      profile: {
        name: user.name,
        email: user.email,
        merchant
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao autenticar.' });
  }
});

app.get('/api/admin/me', requireAdminAuth, async (req, res) => {
  try {
    const merchant = await get('SELECT id, name, category FROM merchants WHERE id = ?', [req.admin.merchantId]);
    return res.json({ name: req.admin.name, email: req.admin.email, merchant });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar perfil.' });
  }
});

app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  adminSessions.delete(token);
  return res.json({ message: 'Sessão finalizada.' });
});

app.get('/api/admin/merchants', requireAdminAuth, async (req, res) => {
  try {
    const merchant = await get('SELECT * FROM merchants WHERE id = ?', [req.admin.merchantId]);
    res.json(merchant ? [merchant] : []);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar comércios.' });
  }
});

app.put('/api/admin/merchants/:merchantId', requireAdminAuth, async (req, res) => {
  const { merchantId } = req.params;
  const { name, category, delivery_fee: deliveryFee, eta_minutes: etaMinutes, rating } = req.body;

  if (!name || !category || !deliveryFee || !etaMinutes || !rating) {
    return res.status(400).json({ message: 'Dados inválidos para atualização do comércio.' });
  }

  if (Number(merchantId) !== req.admin.merchantId) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const result = await run(
      'UPDATE merchants SET name = ?, category = ?, delivery_fee = ?, eta_minutes = ?, rating = ? WHERE id = ?',
      [name, category, deliveryFee, etaMinutes, rating, merchantId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Comércio não encontrado.' });
    }

    return res.json({ message: 'Comércio atualizado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar comércio.' });
  }
});

app.post('/api/admin/merchants/:merchantId/menu', requireAdminAuth, async (req, res) => {
  const { merchantId } = req.params;
  const { name, description, price } = req.body;

  if (!name || !description || !price) {
    return res.status(400).json({ message: 'Dados inválidos para item de cardápio.' });
  }

  if (Number(merchantId) !== req.admin.merchantId) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const result = await run(
      'INSERT INTO menu_items (merchant_id, name, description, price) VALUES (?, ?, ?, ?)',
      [merchantId, name, description, price]
    );

    return res.status(201).json({ id: result.id, message: 'Item adicionado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao adicionar item.' });
  }
});

app.put('/api/admin/menu/:menuItemId', requireAdminAuth, async (req, res) => {
  const { menuItemId } = req.params;
  const { name, description, price } = req.body;

  if (!name || !description || !price) {
    return res.status(400).json({ message: 'Dados inválidos para atualização do item.' });
  }

  try {
    const item = await get('SELECT merchant_id FROM menu_items WHERE id = ?', [menuItemId]);
    if (!item || item.merchant_id !== req.admin.merchantId) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const result = await run(
      'UPDATE menu_items SET name = ?, description = ?, price = ? WHERE id = ?',
      [name, description, price, menuItemId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    return res.json({ message: 'Item atualizado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar item.' });
  }
});

app.delete('/api/admin/menu/:menuItemId', requireAdminAuth, async (req, res) => {
  const { menuItemId } = req.params;

  try {
    const item = await get('SELECT merchant_id FROM menu_items WHERE id = ?', [menuItemId]);
    if (!item || item.merchant_id !== req.admin.merchantId) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const result = await run('DELETE FROM menu_items WHERE id = ?', [menuItemId]);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Item não encontrado.' });
    }

    return res.json({ message: 'Item removido com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao remover item.' });
  }
});

app.get('/api/admin/merchants/:merchantId/orders', requireAdminAuth, async (req, res) => {
  const { merchantId } = req.params;

  if (Number(merchantId) !== req.admin.merchantId) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const orders = await all(
      `SELECT id, customer_name, customer_phone, address, status, total, created_at
       FROM orders
       WHERE merchant_id = ?
       ORDER BY datetime(created_at) DESC`,
      [merchantId]
    );

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar pedidos.' });
  }
});


app.get('/api/admin/merchants/:merchantId/dashboard', requireAdminAuth, async (req, res) => {
  const { merchantId } = req.params;

  if (Number(merchantId) !== req.admin.merchantId) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }

  try {
    const statusRows = await all(
      `SELECT status, COUNT(*) AS total
       FROM orders
       WHERE merchant_id = ?
       GROUP BY status`,
      [merchantId]
    );

    const dailySales = await get(
      `SELECT COALESCE(SUM(total), 0) AS total_sales,
              COUNT(*) AS total_orders
       FROM orders
       WHERE merchant_id = ?
         AND date(created_at) = date('now')
         AND status != 'Cancelado'`,
      [merchantId]
    );

    const topItems = await all(
      `SELECT mi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE o.merchant_id = ?
         AND date(o.created_at) = date('now')
         AND o.status != 'Cancelado'
       GROUP BY mi.id, mi.name
       ORDER BY qty DESC
       LIMIT 5`,
      [merchantId]
    );

    const counters = {
      total: 0,
      recebido: 0,
      concluido: 0,
      cancelado: 0
    };

    for (const row of statusRows) {
      counters.total += row.total;
      if (row.status === 'Recebido' || row.status === 'Em preparo' || row.status === 'Saiu para entrega') {
        counters.recebido += row.total;
      }
      if (row.status === 'Entregue') {
        counters.concluido += row.total;
      }
      if (row.status === 'Cancelado') {
        counters.cancelado += row.total;
      }
    }

    return res.json({ counters, dailySales, topItems });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar dashboard.' });
  }
});

app.patch('/api/admin/orders/:orderId/status', requireAdminAuth, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const allowedStatus = ['Recebido', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Cancelado'];

  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  try {
    const order = await get('SELECT merchant_id FROM orders WHERE id = ?', [orderId]);
    if (!order || order.merchant_id !== req.admin.merchantId) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const result = await run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado.' });
    }

    return res.json({ message: 'Status atualizado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar status do pedido.' });
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
