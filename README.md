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
