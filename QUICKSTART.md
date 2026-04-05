# 🚀 GymMate Quick Start Guide

## One-Command Setup

```bash
cd /home/claude/gym-management-app
./setup.sh
```

This will:
- ✅ Check Node.js installation
- ✅ Install/Start MongoDB
- ✅ Install all dependencies
- ✅ Create configuration files
- ✅ Generate secure JWT secret

## Running the Application

### Terminal 1 - Backend:
```bash
cd /home/claude/gym-management-app/backend
npm start
```

Server will run on: http://localhost:5000

### Terminal 2 - Frontend:
```bash
cd /home/claude/gym-management-app/frontend
npm start
```

App will open on: http://localhost:3000

## First Time Setup

1. **Create Gym Owner Account**:
   - Open http://localhost:3000
   - Click "Gym Owner" tab
   - Click "Register"
   - Fill in your details
   - Enter referral code (if you have one)
   - Click "Register (3 Days Free Trial)"

2. **Download Your Gym QR Code**:
   - Login to dashboard
   - Go to "QR Code" tab
   - Click "Download QR Code"
   - Print and display at gym entrance

3. **Add Your First Member**:
   - Go to "Members" tab
   - Click "+ Add Member"
   - Fill member details
   - Set membership duration (1 month default)
   - Record payment
   - Member can now login!

4. **Test Attendance**:
   - Login as member
   - Go to "Scan QR" tab
   - Scan your gym's QR code
   - Enjoy the success animation! ✨

## Common Commands

### Backend:
```bash
# Start server
npm start

# Start with auto-reload (development)
npm run dev

# Check MongoDB status
sudo systemctl status mongod
```

### Frontend:
```bash
# Start development server
npm start

# Build for production
npm run build
```

## Default Ports

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- MongoDB: mongodb://localhost:27017

## Features to Try

### As Gym Owner:
- ✅ View dashboard statistics
- ✅ Add/manage members
- ✅ Track daily attendance
- ✅ Monitor expiring memberships
- ✅ Get inactive member alerts
- ✅ Record payments
- ✅ Post notices
- ✅ Track visitors
- ✅ Share referral code

### As Member:
- ✅ Scan QR for attendance
- ✅ View workout history
- ✅ Check membership status
- ✅ Read gym notices
- ✅ Share referral code

## Need Help?

Check the full README.md for:
- Detailed API documentation
- Troubleshooting guide
- Deployment instructions
- Feature explanations

## Production Deployment

When ready to deploy:

1. **Backend**:
   - Get a VPS (DigitalOcean, AWS, etc.)
   - Set up MongoDB
   - Configure environment variables
   - Use PM2 for process management

2. **Frontend**:
   - Build: `npm run build`
   - Deploy to Netlify/Vercel
   - Update API URL in .env

---

**That's it! You're ready to manage your gym! 💪**
