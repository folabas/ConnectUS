# ConnectUS Backend

Backend API for ConnectUS - Watch movies together with friends.

## Tech Stack
- **Node.js** with **Express**
- **MongoDB** with **Mongoose**
- **TypeScript**
- **JWT** for authentication
- **bcrypt** for password hashing

## Setup

### Prerequisites
- Node.js (v18+)
- MongoDB (local or Atlas)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp env.example .env
```

3. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/connectus
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

4. Start MongoDB (if running locally):
```bash
mongod
```

5. Run development server:
```bash
npm run dev
```

## API Endpoints

### Authentication & Account Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Create new user account | No |
| POST | `/api/auth/login` | Sign in existing user | No |
| POST | `/api/auth/logout` | Logout user | No |
| POST | `/api/auth/forgot-password` | Send password reset email | No |
| POST | `/api/auth/reset-password/:resetToken` | Reset password | No |
| GET | `/api/auth/me` | Get current user profile | Yes |
| PATCH | `/api/auth/me` | Update user profile | Yes |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts       # MongoDB connection
│   ├── controllers/
│   │   └── authController.ts # Authentication logic
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication middleware
│   ├── models/
│   │   └── User.ts           # User model
│   ├── routes/
│   │   └── authRoutes.ts     # Auth routes
│   ├── utils/
│   │   └── jwt.ts            # JWT utilities
│   └── server.ts             # Express app setup
├── .env.example              # Environment variables template
├── nodemon.json              # Nodemon configuration
├── package.json
└── tsconfig.json             # TypeScript configuration
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","fullName":"Test User"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get Profile (with token)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_EXPIRE` - JWT expiration time (e.g., '7d', '24h')
- `FRONTEND_URL` - Frontend URL for CORS
- `NODE_ENV` - Environment (development/production)

## Notes

- Password reset email functionality is stubbed (logs token to console)
- Implement email service (SendGrid, Nodemailer) for production
- Update JWT_SECRET in production with a strong random key
- Consider adding rate limiting for production
