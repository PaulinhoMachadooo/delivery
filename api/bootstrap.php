<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function envValue(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = envValue('DB_HOST', '127.0.0.1');
    $port = envValue('DB_PORT', '3306');
    $name = envValue('DB_NAME', 'delivery_db');
    $user = envValue('DB_USER', 'root');
    $pass = envValue('DB_PASSWORD', '');

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function getBearerToken(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $header, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

function requireAdminAuth(): array
{
    $token = getBearerToken();
    if (!$token) {
        jsonResponse(['message' => 'Não autorizado.'], 401);
    }

    $stmt = db()->prepare(
        'SELECT s.token, s.expires_at, u.id AS user_id, u.merchant_id, u.name, u.email
         FROM admin_sessions s
         JOIN restaurant_users u ON u.id = s.user_id
         WHERE s.token = ? LIMIT 1'
    );
    $stmt->execute([$token]);
    $session = $stmt->fetch();

    if (!$session || strtotime($session['expires_at']) < time()) {
        jsonResponse(['message' => 'Sessão expirada.'], 401);
    }

    return $session;
}
