<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = preg_replace('#^/api#', '', $path);
$path = rtrim($path, '/');
$path = $path === '' ? '/' : $path;
$body = readJsonBody();

$pdo = db();

if ($method === 'GET' && $path === '/merchants') {
    $rows = $pdo->query('SELECT * FROM merchants ORDER BY rating DESC')->fetchAll();
    jsonResponse($rows);
}

if ($method === 'GET' && preg_match('#^/merchants/(\d+)/menu$#', $path, $m)) {
    $stmt = $pdo->prepare('SELECT * FROM menu_items WHERE merchant_id = ? ORDER BY name');
    $stmt->execute([$m[1]]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'POST' && $path === '/orders') {
    $customerName = $body['customerName'] ?? '';
    $customerPhone = $body['customerPhone'] ?? '';
    $address = $body['address'] ?? '';
    $merchantId = (int)($body['merchantId'] ?? 0);
    $items = $body['items'] ?? [];

    if (!$customerName || !$customerPhone || !$address || !$merchantId || !is_array($items) || count($items) === 0) {
        jsonResponse(['message' => 'Dados do pedido inválidos.'], 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM merchants WHERE id = ?');
    $stmt->execute([$merchantId]);
    $merchant = $stmt->fetch();
    if (!$merchant) {
        jsonResponse(['message' => 'Comércio não encontrado.'], 404);
    }

    $menuStmt = $pdo->prepare('SELECT id, price FROM menu_items WHERE id = ? AND merchant_id = ?');
    $subtotal = 0;
    $validatedItems = [];

    foreach ($items as $item) {
        $menuId = (int)($item['menuItemId'] ?? 0);
        $qty = (int)($item['quantity'] ?? 0);
        if ($menuId < 1 || $qty < 1) {
            jsonResponse(['message' => 'Itens inválidos.'], 400);
        }
        $menuStmt->execute([$menuId, $merchantId]);
        $menu = $menuStmt->fetch();
        if (!$menu) {
            jsonResponse(['message' => 'Itens inválidos para esse comércio.'], 400);
        }
        $subtotal += ((float)$menu['price']) * $qty;
        $validatedItems[] = ['menu_item_id' => $menuId, 'quantity' => $qty, 'unit_price' => (float)$menu['price']];
    }

    $deliveryFee = (float)$merchant['delivery_fee'];
    $total = $subtotal + $deliveryFee;

    $pdo->beginTransaction();
    try {
        $orderStmt = $pdo->prepare('INSERT INTO orders (customer_name, customer_phone, address, merchant_id, status, subtotal, delivery_fee, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())');
        $orderStmt->execute([$customerName, $customerPhone, $address, $merchantId, 'Recebido', $subtotal, $deliveryFee, $total]);
        $orderId = (int)$pdo->lastInsertId();

        $itemStmt = $pdo->prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
        foreach ($validatedItems as $i) {
            $itemStmt->execute([$orderId, $i['menu_item_id'], $i['quantity'], $i['unit_price']]);
        }

        $pdo->commit();
        jsonResponse(['orderId' => $orderId, 'status' => 'Recebido', 'etaMinutes' => (int)$merchant['eta_minutes'], 'total' => $total], 201);
    } catch (Throwable $e) {
        $pdo->rollBack();
        jsonResponse(['message' => 'Erro ao criar pedido.'], 500);
    }
}

if ($method === 'POST' && $path === '/admin/login') {
    $email = trim((string)($body['email'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if (!$email || !$password) {
        jsonResponse(['message' => 'Informe e-mail e senha.'], 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM restaurant_users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonResponse(['message' => 'Credenciais inválidas.'], 401);
    }

    $valid = hash_equals((string)$user['password_hash'], $password) || password_verify($password, (string)$user['password_hash']);
    if (!$valid) {
        jsonResponse(['message' => 'Credenciais inválidas.'], 401);
    }

    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 60 * 60 * 12);
    $ins = $pdo->prepare('INSERT INTO admin_sessions (token, user_id, expires_at) VALUES (?, ?, ?)');
    $ins->execute([$token, $user['id'], $expires]);

    $mStmt = $pdo->prepare('SELECT id, name, category FROM merchants WHERE id = ?');
    $mStmt->execute([$user['merchant_id']]);
    $merchant = $mStmt->fetch();

    jsonResponse(['token' => $token, 'profile' => ['name' => $user['name'], 'email' => $user['email'], 'merchant' => $merchant]]);
}

if ($method === 'GET' && $path === '/admin/me') {
    $session = requireAdminAuth();
    $mStmt = $pdo->prepare('SELECT id, name, category FROM merchants WHERE id = ?');
    $mStmt->execute([$session['merchant_id']]);
    jsonResponse(['name' => $session['name'], 'email' => $session['email'], 'merchant' => $mStmt->fetch()]);
}

if ($method === 'POST' && $path === '/admin/logout') {
    $token = getBearerToken();
    if ($token) {
      $stmt = $pdo->prepare('DELETE FROM admin_sessions WHERE token = ?');
      $stmt->execute([$token]);
    }
    jsonResponse(['message' => 'Sessão finalizada.']);
}

if ($method === 'GET' && $path === '/admin/merchants') {
    $session = requireAdminAuth();
    $stmt = $pdo->prepare('SELECT * FROM merchants WHERE id = ?');
    $stmt->execute([$session['merchant_id']]);
    $row = $stmt->fetch();
    jsonResponse($row ? [$row] : []);
}

if ($method === 'GET' && preg_match('#^/admin/merchants/(\d+)/orders$#', $path, $m)) {
    $session = requireAdminAuth();
    if ((int)$m[1] !== (int)$session['merchant_id']) jsonResponse(['message' => 'Acesso negado.'], 403);
    $stmt = $pdo->prepare('SELECT id, customer_name, customer_phone, address, status, total, created_at FROM orders WHERE merchant_id = ? ORDER BY created_at DESC');
    $stmt->execute([$m[1]]);
    jsonResponse($stmt->fetchAll());
}

if ($method === 'GET' && preg_match('#^/admin/merchants/(\d+)/dashboard$#', $path, $m)) {
    $session = requireAdminAuth();
    $merchantId = (int)$m[1];
    if ($merchantId !== (int)$session['merchant_id']) jsonResponse(['message' => 'Acesso negado.'], 403);

    $statusRows = $pdo->prepare('SELECT status, COUNT(*) AS total FROM orders WHERE merchant_id = ? GROUP BY status');
    $statusRows->execute([$merchantId]);
    $rows = $statusRows->fetchAll();

    $daily = $pdo->prepare("SELECT COALESCE(SUM(total),0) AS total_sales, COUNT(*) AS total_orders FROM orders WHERE merchant_id = ? AND DATE(created_at)=CURDATE() AND status!='Cancelado'");
    $daily->execute([$merchantId]);
    $dailySales = $daily->fetch();

    $top = $pdo->prepare("SELECT mi.name, SUM(oi.quantity) AS qty FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN menu_items mi ON mi.id = oi.menu_item_id WHERE o.merchant_id = ? AND DATE(o.created_at)=CURDATE() AND o.status!='Cancelado' GROUP BY mi.id, mi.name ORDER BY qty DESC LIMIT 5");
    $top->execute([$merchantId]);

    $counters = ['total' => 0, 'recebido' => 0, 'concluido' => 0, 'cancelado' => 0];
    foreach ($rows as $r) {
      $q = (int)$r['total'];
      $counters['total'] += $q;
      if (in_array($r['status'], ['Recebido','Em preparo','Saiu para entrega'], true)) $counters['recebido'] += $q;
      if ($r['status'] === 'Entregue') $counters['concluido'] += $q;
      if ($r['status'] === 'Cancelado') $counters['cancelado'] += $q;
    }

    jsonResponse(['counters' => $counters, 'dailySales' => $dailySales, 'topItems' => $top->fetchAll()]);
}

jsonResponse(['message' => 'Rota não encontrada.'], 404);
