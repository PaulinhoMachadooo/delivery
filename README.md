# Entrega Certa - Plataforma de Delivery

Aplicação full stack para pedidos de comida com múltiplos comércios da cidade.

## Funcionalidades

- Lista de comércios com taxa de entrega, avaliação e tempo estimado.
- Cardápio por comércio.
- Carrinho de compras.
- Checkout com dados de entrega.
- API para criação e consulta de pedidos.
- Banco SQLite com seed inicial de restaurantes e itens.

## Tecnologias

- Node.js + Express
- SQLite
- Front-end em HTML, CSS e JavaScript

## Como executar

```bash
npm install
npm start
```

Acesse: `http://localhost:3000`

## Endpoints principais

- `GET /api/merchants`
- `GET /api/merchants/:merchantId/menu`
- `POST /api/orders`
- `GET /api/orders/:orderId`

## Configurar banco na Hostinger (MySQL)

1. Crie um banco MySQL na Hostinger e um usuário com permissão total.
2. Copie `.env.example` para `.env` e preencha as variáveis (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
3. Instale dependências e inicialize o schema:

```bash
npm install
npm run init:hostinger-db
```

Arquivos de apoio:
- Schema SQL: `db/hostinger-schema.sql`
- Script de inicialização: `scripts/init-hostinger-db.js`

## Backend em PHP (Hostinger)

O backend foi reescrito para PHP e exposto em `api/index.php` com roteamento via `.htaccess`.

### Rotas
- `GET /api/merchants`
- `GET /api/merchants/:merchantId/menu`
- `POST /api/orders`
- `POST /api/admin/login`
- `GET /api/admin/me`
- `POST /api/admin/logout`
- `GET /api/admin/merchants`
- `GET /api/admin/merchants/:merchantId/orders`
- `GET /api/admin/merchants/:merchantId/dashboard`

### Deploy na Hostinger
1. Envie os arquivos para `public_html`.
2. Configure variáveis de ambiente do banco (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`).
3. Importe `db/hostinger-schema.sql` no phpMyAdmin.
4. Garanta que o módulo `mod_rewrite` esteja habilitado para o `.htaccess`.
