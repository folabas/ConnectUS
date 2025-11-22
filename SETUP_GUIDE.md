# ConnectUS - Backend Authentication Setup Guide

## 🎯 Overview

This guide will help you set up and test the ConnectUS backend authentication system. The backend is built with Node.js, Express, MongoDB, and TypeScript.

## 📋 Prerequisites

Before starting, ensure you have:
- **Node.js** (v18 or higher)
- **MongoDB** (local installation or MongoDB Atlas account)
- **Git** (for version control)

## 🚀 Quick Start

### 1. Switch to Backend Branch

The backend code is on the `backend` branch:

```bash
git checkout backend
```

### 2. Set Up Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory (copy from `env.example`):

```bash
# In backend directory
cp env.example .env
```

Edit `.env` with your configuration:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/connectus
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Important:** 
- If using MongoDB Atlas, replace `MONGODB_URI` with your Atlas connection string
- Change `JWT_SECRET` to a strong random string in production

### 4. Start MongoDB

If using local MongoDB:

```bash
mongod
```

If using MongoDB Atlas, ensure your connection string is correct in `.env`.

### 5. Start Backend Server

```bash
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📍 API URL: http://localhost:5000
🏥 Health check: http://localhost:5000/api/health
```

### 6. Configure Frontend

In the root directory, create `.env.local` (copy from `env.local.example`):

```bash
# In root directory (not backend)
cp env.local.example .env.local
```

The file should contain:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 7. Start Frontend

In a new terminal, from the root directory:

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`.

## 🧪 Testing the Authentication

### Option 1: Using the Frontend UI

1. Open `http://localhost:3000` in your browser
2. Click "Get Started" or "Sign In"
3. Try creating a new account:
   - Enter your full name
   - Enter an email address
   - Enter a password (minimum 6 characters)
   - Click "Create Account"
4. You should see a success message and be logged in
5. Try logging out and logging back in

### Option 2: Using cURL or Postman

#### Register a New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "test@example.com",
    "fullName": "Test User",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2025-11-28T..."
  }
}
```

#### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Get Current User Profile

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### Update Profile

```bash
curl -X PATCH http://localhost:5000/api/auth/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "fullName": "Updated Name"
  }'
```

## 📁 Project Structure

```
ConnectUS/
├── backend/                    # Backend API
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts    # MongoDB connection
│   │   ├── controllers/
│   │   │   └── authController.ts  # Auth logic
│   │   ├── middleware/
│   │   │   └── auth.ts        # JWT middleware
│   │   ├── models/
│   │   │   └── User.ts        # User schema
│   │   ├── routes/
│   │   │   └── authRoutes.ts  # Auth routes
│   │   ├── utils/
│   │   │   └── jwt.ts         # JWT utilities
│   │   └── server.ts          # Express app
│   ├── .env                   # Environment variables (create this)
│   ├── env.example            # Environment template
│   ├── package.json
│   └── tsconfig.json
├── src/                       # Frontend
│   ├── components/
│   │   └── Authentication.tsx # Login/Register UI
│   ├── services/
│   │   └── api.ts            # API service layer
│   └── ...
├── .env.local                # Frontend env (create this)
└── env.local.example         # Frontend env template
```

## 🔐 API Endpoints

All authentication endpoints are available at `http://localhost:5000/api/auth`:

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Create new account | No |
| POST | `/login` | Sign in | No |
| POST | `/logout` | Sign out | No |
| GET | `/me` | Get current user | Yes |
| PATCH | `/me` | Update profile | Yes |
| POST | `/forgot-password` | Request password reset | No |
| POST | `/reset-password/:token` | Reset password | No |

## 🐛 Troubleshooting

### MongoDB Connection Error

**Error:** `MongoDB connection error`

**Solutions:**
- Ensure MongoDB is running (`mongod`)
- Check `MONGODB_URI` in `.env`
- For Atlas, verify IP whitelist and credentials

### CORS Error

**Error:** `Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' has been blocked by CORS`

**Solution:**
- Ensure `FRONTEND_URL=http://localhost:3000` in backend `.env`
- Restart backend server

### Token Invalid Error

**Error:** `Invalid or expired token`

**Solutions:**
- Check that `JWT_SECRET` matches in backend `.env`
- Token may have expired (default 7 days)
- Try logging in again to get a new token

### Port Already in Use

**Error:** `Port 5000 is already in use`

**Solutions:**
- Change `PORT` in backend `.env` to another port (e.g., 5001)
- Kill the process using port 5000
- Update `NEXT_PUBLIC_API_URL` in frontend `.env.local` if you change the port

## 📝 Next Steps

Now that authentication is working, you can:

1. **Test all endpoints** using Postman or Thunder Client
2. **Implement additional features:**
   - Movie library endpoints
   - Room management endpoints
   - Real-time sync with WebSocket
   - Video chat with WebRTC
3. **Add more validation** and error handling
4. **Implement email service** for password reset
5. **Add rate limiting** for security

## 💡 Notes

- **WebRTC vs WebSocket:** For your question about video chat - WebRTC is used for peer-to-peer video/audio streaming, while WebSocket (Socket.io) is used for signaling and real-time sync. Both work together!
- **Password Reset:** Currently logs the reset token to console. Implement email service (SendGrid, Nodemailer) for production.
- **Security:** Remember to use strong `JWT_SECRET` in production and enable HTTPS.

## 🎉 Success!

If you can register, login, and see your profile data, the authentication system is working correctly! You're now ready to build the rest of the ConnectUS backend.
