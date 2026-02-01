# API Contract - Expense Tracker Backend

## Overview

This document serves as the complete API contract for frontend developers integrating with the Expense Tracker backend. The backend provides a RESTful API with JWT authentication for managing expenses, budgets, and viewing analytics.

## Base URL
```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

### JWT Token-Based Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Authentication Flow
1. **Sign up** → Create user account
2. **Login** → Receive JWT token
3. **Use token** → Access protected routes

## API Endpoints

### 🔐 Authentication

#### POST /auth/signup
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "id": "cuid123",
  "email": "user@example.com",
  "fullName": "John Doe",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid123",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

### 👤 User

#### GET /users/me
Get current user profile (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "cuid123",
  "email": "user@example.com",
  "fullName": "John Doe"
}
```

---

### 💰 Expenses

#### POST /expenses
Create a new expense (protected).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 50.00,
  "category": "Food",
  "date": "2024-01-15",
  "description": "Lunch at restaurant"
}
```

**Response (201):**
```json
{
  "id": "cuid456",
  "amount": 50.00,
  "category": "Food",
  "date": "2024-01-15T00:00:00Z",
  "description": "Lunch at restaurant",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "userId": "cuid123"
}
```

#### GET /expenses
Get all expenses for current user (protected).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `month` (optional): Filter by month (YYYY-MM format)
- `category` (optional): Filter by category
- `search` (optional): Search in description and category

**Response (200):**
```json
[
  {
    "id": "cuid456",
    "amount": 50.00,
    "category": "Food",
    "date": "2024-01-15T00:00:00Z",
    "description": "Lunch at restaurant",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "userId": "cuid123"
  }
]
```

#### GET /expenses/categories
Get all expense categories for current user (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
["Food", "Transport", "Entertainment", "Utilities"]
```

#### GET /expenses/:id
Get a specific expense (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "cuid456",
  "amount": 50.00,
  "category": "Food",
  "date": "2024-01-15T00:00:00Z",
  "description": "Lunch at restaurant",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "userId": "cuid123"
}
```

#### PUT /expenses/:id
Update an expense (protected).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 60.00,
  "description": "Updated lunch expense"
}
```

**Response (200):**
```json
{
  "id": "cuid456",
  "amount": 60.00,
  "category": "Food",
  "date": "2024-01-15T00:00:00Z",
  "description": "Updated lunch expense",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T09:15:00Z",
  "userId": "cuid123"
}
```

#### DELETE /expenses/:id
Delete an expense (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### 📊 Budgets

#### POST /budgets
Create a new budget (protected).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Monthly Food Budget",
  "amount": 500.00,
  "category": "Food",
  "period": "monthly",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

**Response (201):**
```json
{
  "id": "cuid789",
  "name": "Monthly Food Budget",
  "amount": 500.00,
  "category": "Food",
  "period": "monthly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z",
  "userId": "cuid123"
}
```

#### GET /budgets
Get all budgets for current user (protected).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `category` (optional): Filter by category
- `period` (optional): Filter by period (monthly, weekly, yearly)
- `active` (optional): Filter by active status (true/false)

**Response (200):**
```json
[
  {
    "id": "cuid789",
    "name": "Monthly Food Budget",
    "amount": 500.00,
    "category": "Food",
    "period": "monthly",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "userId": "cuid123"
  }
]
```

#### GET /budgets/:id
Get a specific budget (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "cuid789",
  "name": "Monthly Food Budget",
  "amount": 500.00,
  "category": "Food",
  "period": "monthly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z",
  "userId": "cuid123"
}
```

#### GET /budgets/:id/expenses
Get budget with expense comparison (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "budget": {
    "id": "cuid789",
    "name": "Monthly Food Budget",
    "amount": 500.00,
    "category": "Food",
    "period": "monthly",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "userId": "cuid123"
  },
  "totalSpent": 450.00,
  "remaining": 50.00,
  "percentageUsed": 90.0,
  "expenses": [
    {
      "id": "cuid456",
      "amount": 50.00,
      "category": "Food",
      "date": "2024-01-15T00:00:00Z",
      "description": "Lunch at restaurant",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "userId": "cuid123"
    }
  ]
}
```

#### PUT /budgets/:id
Update a budget (protected).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 600.00,
  "name": "Updated Monthly Food Budget"
}
```

**Response (200):**
```json
{
  "id": "cuid789",
  "name": "Updated Monthly Food Budget",
  "amount": 600.00,
  "category": "Food",
  "period": "monthly",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-16T09:20:00Z",
  "userId": "cuid123"
}
```

#### DELETE /budgets/:id
Delete a budget (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (204):** No content

---

### 📈 Dashboard Analytics

#### GET /dashboard/overview
Get dashboard overview with key metrics (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "totalSpent": 2500.00,
  "totalExpenses": 45,
  "averageMonthlyExpense": 833.33,
  "currentMonthSpent": 650.00,
  "currentMonthExpenses": 12
}
```

#### GET /dashboard/monthly-summaries
Get monthly expense summaries (protected).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `months` (optional): Number of months to include (1-24, default: 12)

**Response (200):**
```json
[
  {
    "month": "2024-01",
    "totalSpent": 1250.50,
    "expenseCount": 15,
    "averageExpense": 83.37
  },
  {
    "month": "2023-12",
    "totalSpent": 980.25,
    "expenseCount": 12,
    "averageExpense": 81.69
  }
]
```

#### GET /dashboard/category-breakdown
Get category breakdown (protected).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `month` (optional): Filter by specific month (YYYY-MM format)

**Response (200):**
```json
[
  {
    "category": "Food",
    "totalSpent": 450.00,
    "expenseCount": 8,
    "percentage": 36.0
  },
  {
    "category": "Transport",
    "totalSpent": 300.00,
    "expenseCount": 5,
    "percentage": 24.0
  },
  {
    "category": "Entertainment",
    "totalSpent": 200.00,
    "expenseCount": 3,
    "percentage": 16.0
  }
]
```

#### GET /dashboard/budget-comparisons
Get budget vs expense comparisons (protected).

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "budgetId": "cuid789",
    "budgetName": "Monthly Food Budget",
    "budgetAmount": 500.00,
    "totalSpent": 450.00,
    "remaining": 50.00,
    "percentageUsed": 90.0,
    "status": "on-track"
  },
  {
    "budgetId": "cuid790",
    "budgetName": "Monthly Transport Budget",
    "budgetAmount": 200.00,
    "totalSpent": 250.00,
    "remaining": -50.00,
    "percentageUsed": 125.0,
    "status": "over"
  }
]
```

---

### 🏥 Health Check

#### GET /health
Check API health status (public).

**Response (200):**
```json
{
  "status": "ok"
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "message": "Error description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Common Error Scenarios

#### Authentication Errors
```json
{
  "message": "User not authenticated"
}
```

#### Validation Errors
```json
{
  "message": "Email is required"
}
```

#### Resource Not Found
```json
{
  "message": "Expense not found"
}
```

---

## Frontend Integration Guide

### 1. Authentication Flow
```javascript
// Login and store token
const login = async (email, password) => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  localStorage.setItem('token', data.token);
  return data.user;
};

// Add token to all protected requests
const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};
```

### 2. Expense Management
```javascript
// Create expense
const createExpense = async (expenseData) => {
  return await authenticatedFetch('/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
};

// Get expenses with filters
const getExpenses = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  return await authenticatedFetch(`/expenses?${params}`);
};
```

### 3. Dashboard Data
```javascript
// Get dashboard overview
const getDashboardOverview = async () => {
  return await authenticatedFetch('/dashboard/overview');
};

// Get monthly summaries
const getMonthlySummaries = async (months = 12) => {
  return await authenticatedFetch(`/dashboard/monthly-summaries?months=${months}`);
};
```

### 4. Error Handling
```javascript
const handleApiCall = async (apiCall) => {
  try {
    const response = await apiCall();
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return await response.json();
  } catch (error) {
    // Handle authentication errors
    if (error.message.includes('not authenticated')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw error;
  }
};
```

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}
```

### Expense
```typescript
interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}
```

### Budget
```typescript
interface Budget {
  id: string;
  name: string;
  amount: number;
  category?: string;
  period: 'monthly' | 'weekly' | 'yearly';
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}
```

---

## Testing

### Interactive Documentation
Visit `/api-docs` for interactive Swagger documentation with "Try it out" functionality.

### Example Test Flow
1. **Health Check**: `GET /health`
2. **Sign Up**: `POST /auth/signup`
3. **Login**: `POST /auth/login`
4. **Create Expense**: `POST /expenses`
5. **Get Dashboard**: `GET /dashboard/overview`

---

## Rate Limiting & Security

- JWT tokens expire after 24 hours
- All passwords are hashed using bcrypt
- Input validation on all endpoints
- SQL injection protection via Prisma ORM
- CORS configured for frontend domains

---

## Support

For API issues or questions:
1. Check the interactive documentation at `/api-docs`
2. Review error messages for specific issues
3. Ensure proper authentication headers are included
4. Validate request body formats match the examples above