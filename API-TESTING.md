# API Testing Guide

## Swagger Documentation (Recommended)

**Start your server and visit:**
```
http://localhost:3000/api-docs
```

Swagger provides:
- **Interactive API documentation**
- **Try it out** buttons for each endpoint
- **Automatic JWT authentication** handling
- **Request/response examples**
- **Parameter validation**

---

## Manual Testing (cURL)

### Setup

1. **Start PostgreSQL:**
   ```bash
   docker-compose up -d
   ```

2. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

3. **Push schema to database:**
   ```bash
   npm run db:push
   ```

4. **Start server:**
   ```bash
   npm run dev
   ```

## Base URL
`http://localhost:3000`

## Authentication Flow

### 1. Sign Up
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Test User",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Copy the `token` from the login response - you'll need it for protected routes.**

## Protected Routes (add Authorization header)

Replace `YOUR_JWT_TOKEN` with the token from login:

```bash
# Get User Profile
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create Expense
curl -X POST http://localhost:3000/expenses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50.00,
    "category": "Food",
    "date": "2024-01-15",
    "description": "Lunch at restaurant"
  }'

# Get All Expenses
curl -X GET http://localhost:3000/expenses \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Categories
curl -X GET http://localhost:3000/expenses/categories \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create Budget
curl -X POST http://localhost:3000/budgets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monthly Food Budget",
    "amount": 500.00,
    "category": "Food",
    "period": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'

# Get All Budgets
curl -X GET http://localhost:3000/budgets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Dashboard Overview
curl -X GET http://localhost:3000/dashboard/overview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Monthly Summaries
curl -X GET http://localhost:3000/dashboard/monthly-summaries \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Category Breakdown
curl -X GET http://localhost:3000/dashboard/category-breakdown \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Budget Comparisons
curl -X GET http://localhost:3000/dashboard/budget-comparisons \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Health Check
```bash
curl http://localhost:3000/health
```

## Postman Manual Setup

If you prefer Postman:

1. **Create Collection** → "Expense Tracker Backend"
2. **Add Variables:**
   - `baseUrl`: `http://localhost:3000`
   - `jwtToken`: (leave empty, will be set automatically)

3. **Create Requests:**

### Authentication
- **POST** `{{baseUrl}}/auth/signup`
- **POST** `{{baseUrl}}/auth/login`
  - Add test script: `if (pm.response.code === 200) { const response = pm.response.json(); pm.collectionVariables.set('jwtToken', response.token); }`

### User
- **GET** `{{baseUrl}}/users/me`
  - Headers: `Authorization: Bearer {{jwtToken}}`

### Expenses
- **POST** `{{baseUrl}}/expenses` (with body)
- **GET** `{{baseUrl}}/expenses`
- **GET** `{{baseUrl}}/expenses/categories`
  - All with `Authorization: Bearer {{jwtToken}}`

### Budgets
- **POST** `{{baseUrl}}/budgets` (with body)
- **GET** `{{baseUrl}}/budgets`
  - All with `Authorization: Bearer {{jwtToken}}`

### Dashboard
- **GET** `{{baseUrl}}/dashboard/overview`
- **GET** `{{baseUrl}}/dashboard/monthly-summaries`
- **GET** `{{baseUrl}}/dashboard/category-breakdown`
- **GET** `{{baseUrl}}/dashboard/budget-comparisons`
  - All with `Authorization: Bearer {{jwtToken}}`

## Testing Flow

1. **Start server** → `npm run dev`
2. **Visit Swagger** → `http://localhost:3000/api-docs`
3. **Test authentication** → Sign up, then login
4. **Test CRUD operations** → Use Swagger's "Try it out"
5. **Verify data** → Check that everything works

## Common Issues

- **401 Unauthorized**: Check your JWT token
- **400 Bad Request**: Check request body format
- **Database connection**: Ensure Docker PostgreSQL is running
- **Port conflicts**: Make sure port 3000 is free
- **Swagger not loading**: Check that server is running

## Features Available

- ✅ **Authentication** (JWT-based)
- ✅ **User management** (profile view)
- ✅ **Expense CRUD** (create, read, update, delete)
- ✅ **Expense filtering** (by month, category, search)
- ✅ **Budget CRUD** (create, read, update, delete)
- ✅ **Budget vs expense comparison**
- ✅ **Dashboard analytics** (monthly summaries, category breakdowns)
- ✅ **Interactive documentation** (Swagger)
- ✅ **Health check endpoint**
