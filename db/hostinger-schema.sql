CREATE TABLE IF NOT EXISTS merchants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL,
  eta_minutes INT NOT NULL,
  rating DECIMAL(3,1) NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_menu_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  address TEXT NOT NULL,
  merchant_id INT NOT NULL,
  status VARCHAR(40) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_orders_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

CREATE TABLE IF NOT EXISTS restaurant_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id INT NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_salt VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  CONSTRAINT fk_user_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

INSERT INTO merchants (name, category, delivery_fee, eta_minutes, rating)
SELECT * FROM (
  SELECT 'Pizzaria Bella Massa', 'Pizza', 6.90, 35, 4.8 UNION ALL
  SELECT 'Sushi Centro', 'Japonês', 8.50, 45, 4.7 UNION ALL
  SELECT 'Burguer da Praça', 'Hambúrguer', 5.90, 30, 4.6
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM merchants LIMIT 1);

INSERT INTO menu_items (merchant_id, name, description, price)
SELECT * FROM (
  SELECT 1, 'Pizza Margherita', 'Molho de tomate, mussarela e manjericão fresco.', 49.90 UNION ALL
  SELECT 1, 'Pizza Calabresa', 'Calabresa artesanal, cebola roxa e azeitonas.', 55.90 UNION ALL
  SELECT 1, 'Refrigerante 2L', 'Escolha entre cola, laranja ou guaraná.', 12.00 UNION ALL
  SELECT 2, 'Combinado 20 peças', 'Sashimi, nigiri e uramaki selecionados.', 69.90 UNION ALL
  SELECT 2, 'Temaki Salmão', 'Temaki grande com cream cheese e cebolinha.', 28.90 UNION ALL
  SELECT 2, 'Yakissoba Frango', 'Macarrão oriental com legumes e frango.', 35.50 UNION ALL
  SELECT 3, 'Burger Clássico', 'Pão brioche, carne 160g, queijo e molho da casa.', 29.90 UNION ALL
  SELECT 3, 'Burger Duplo Bacon', 'Dois blends 120g, cheddar e bacon crocante.', 39.90 UNION ALL
  SELECT 3, 'Batata Rústica', 'Porção de batata rústica com páprica defumada.', 19.90
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM menu_items LIMIT 1);
