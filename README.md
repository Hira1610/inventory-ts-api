# Inventory API (Node.js, Express, TypeScript)

A REST API for managing products and stock levels with role-based access.

## Features
- Register/login with bcrypt-hashed passwords and JWT; the first registered user becomes `admin`, others are `staff`
- Admin-only product create and delete; all users can view and adjust stock
- Request validation with Zod, central error handler, proper status codes (400/401/403/404/409)
- Search, pagination and a low-stock report; stock can never go below zero
- 12 automated tests (Jest + Supertest) using an in-memory SQLite database; Dockerfile and GitHub Actions CI

## Tech
Node.js, Express, TypeScript, SQLite (better-sqlite3), JWT, Zod, Jest, Docker

## Run locally
```bash
npm install
npm run dev          # http://localhost:3000
npm test
```
Set `JWT_SECRET` in production.

## Endpoints
| Method | URL | Access |
|---|---|---|
| POST | /auth/register, /auth/login | public |
| GET | /products?search=&page=&limit= | logged in |
| GET | /products/low-stock?threshold=5 | logged in |
| GET | /products/:id | logged in |
| POST | /products | admin |
| PATCH | /products/:id/stock  `{"change": -2}` | logged in |
| DELETE | /products/:id | admin |

## Possible next steps
React front end, MongoDB/PostgreSQL version, refresh tokens, rate limiting, Swagger docs.
