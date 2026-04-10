# 💪 GymMate - Complete Gym Management System

A full-stack gym management application built with React, Node.js, Express, and MongoDB. Designed specifically for frustrated gym owners to manage members, payments, attendance, and more!

## 🌟 Features

### For Gym Owners:
- ✅ **3-Day Free Trial** - Test all features before subscribing
- 📊 **Dashboard Overview** - Quick stats on members, attendance, and revenue
- 👥 **Member Management** - Add, edit, and track all gym members
- 💳 **Payment Tracking** - Record and monitor all membership payments
- 📱 **Unique QR Code** - Generate gym-specific QR code for attendance
- 📢 **Notice Board** - Post announcements for all members to see
- 👋 **Visitor Tracking** - Keep records of potential new members
- ⚠️ **Smart Alerts**:
  - Members with expiring memberships (within 7 days)
  - Inactive members (no attendance for 3+ days)
  - Membership expiry notifications
- 🎁 **Referral System** - Earn ₹200 per referral, customers get ₹200 discount
- 📈 **Analytics** - Track attendance patterns and revenue trends

### For Members:
- 📱 **QR Code Scanning** - Quick check-in/check-out with animated success feedback
- 📊 **Attendance History** - View complete workout history
- 📢 **Notice Board** - Stay updated with gym announcements
- 👤 **Profile Management** - View membership details and status
- ⏰ **Expiry Alerts** - Get notified before membership expires
- 🎁 **Referral Rewards** - Share your code and earn rewards

### Automated Features:
- 🤖 **Auto-expire** memberships 3 days after expiry date
- 📧 **Auto-notifications** for expiring memberships
- 🔔 **Daily attendance tracking**
- 💰 **Automated subscription management**

## 🏗️ Tech Stack

### Backend:
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication
- bcrypt (Password hashing)
- QRCode generation
- node-cron (Scheduled tasks)

### Frontend:
- React 18
- React Router DOM
- Axios
- QR Scanner/Generator
- Framer Motion (Animations)
- Recharts (Data visualization)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- MongoDB (v4.4 or higher)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
cd /home/claude/gym-management-app
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and configure:
# - MongoDB connection string
# - JWT secret
# - Email credentials (optional)

# Start MongoDB (if not running)
sudo systemctl start mongod

# Run the backend server
npm start
# Or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start the frontend
npm start
```

The frontend will run on `http://localhost:3000`

## 📱 Usage Guide

### For Gym Owners:

1. **Registration**:
   - Go to login page
   - Select "Gym Owner" tab
   - Click "Register"
   - Fill in details (use referral code if you have one)
   - Get 3 days free trial!

2. **Add Members**:
   - Login to owner dashboard
   - Go to "Members" tab
   - Click "Add Member"
   - Fill member details and set membership duration
   - Member receives login credentials

3. **Generate QR Code**:
   - Go to "QR Code" tab
   - Download and print the QR code
   - Display it at gym entrance

4. **Track Attendance**:
   - Members scan QR to check-in
   - View real-time attendance on dashboard
   - Get alerts for inactive members

5. **Manage Payments**:
   - Record payments when members pay
   - Extend/renew memberships
   - View payment history and revenue stats

6. **Post Notices**:
   - Go to "Notices" tab
   - Create announcements
   - All members see them instantly

### For Members:

1. **Login**:
   - Get credentials from gym owner
   - Select "Member" tab
   - Enter email and password

2. **Mark Attendance**:
   - Go to "Scan QR" tab
   - Scan gym's QR code
   - Enjoy the success animation!
   - Check-out when leaving

3. **View Stats**:
   - Check your attendance history
   - See monthly progress
   - Track workout duration

4. **Check Membership**:
   - View expiry date on home screen
   - Get alerts when renewal is due

## 🗂️ Project Structure

```
gym-management-app/
├── backend/
│   ├── models/
│   │   ├── User.js          # User model (owners & members)
│   │   ├── Payment.js       # Payment records
│   │   ├── Attendance.js    # Attendance tracking
│   │   ├── Visitor.js       # Visitor management
│   │   └── Notice.js        # Notice board
│   ├── routes/
│   │   ├── auth.js          # Authentication
│   │   ├── members.js       # Member management
│   │   ├── attendance.js    # Attendance APIs
│   │   ├── payments.js      # Payment tracking
│   │   ├── visitors.js      # Visitor management
│   │   └── notices.js       # Notice board
│   ├── middleware/
│   │   └── auth.js          # JWT authentication
│   ├── utils/
│   │   └── cronJobs.js      # Automated tasks
│   ├── server.js            # Main server file
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── OwnerDashboard.jsx
│   │   │   ├── MemberDashboard.jsx
│   │   │   ├── AttendanceScanner.jsx
│   │   │   └── *.css
│   │   ├── animations/
│   │   │   ├── SuccessAnimation.jsx
│   │   │   └── SuccessAnimation.css
│   │   ├── utils/
│   │   │   └── api.js       # API configuration
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── .env
│
└── README.md
```

## 🔐 Default Credentials

After first run, you can create test accounts:

**Gym Owner**:
- Register through the app
- Get 3 days free trial

**Member**:
- Created by gym owner
- Credentials provided by owner

## 💰 Pricing

- **Gym Owners**: ₹700/month (after 3-day trial)
- **Referral Bonus**: ₹200 for referrer, ₹200 discount for new owner
- **Members**: Free to use (paid to gym owner)

## 🔧 Configuration

### Backend Environment Variables (.env):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gymmate
JWT_SECRET=your_super_secret_key
NODE_ENV=development

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### Frontend Environment Variables (.env):

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📊 API Endpoints

### Authentication:
- `POST /api/auth/register/owner` - Register gym owner
- `POST /api/auth/register/member` - Register member
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Members:
- `GET /api/members/gym/:ownerId` - Get all members
- `GET /api/members/:memberId` - Get member details
- `PUT /api/members/:memberId` - Update member
- `POST /api/members/:memberId/membership` - Renew membership
- `DELETE /api/members/:memberId` - Delete member
- `GET /api/members/gym/:ownerId/expiring` - Get expiring memberships
- `GET /api/members/gym/:ownerId/inactive` - Get inactive members

### Attendance:
- `POST /api/attendance/checkin` - Mark check-in
- `POST /api/attendance/checkout` - Mark check-out
- `GET /api/attendance/member/:memberId` - Member attendance history
- `GET /api/attendance/gym/:ownerId` - Gym attendance
- `GET /api/attendance/gym/:ownerId/stats` - Attendance statistics

### Payments:
- `POST /api/payments` - Record payment
- `GET /api/payments/user/:userId` - User payments
- `GET /api/payments/gym/:ownerId` - Gym payments
- `POST /api/payments/subscription` - Process subscription
- `GET /api/payments/gym/:ownerId/stats` - Payment statistics

### Visitors:
- `POST /api/visitors` - Add visitor
- `GET /api/visitors/gym/:ownerId` - Get visitors
- `PUT /api/visitors/:visitorId` - Update visitor
- `DELETE /api/visitors/:visitorId` - Delete visitor

### Notices:
- `POST /api/notices` - Create notice
- `GET /api/notices/gym/:ownerId` - Get notices
- `PUT /api/notices/:noticeId` - Update notice
- `DELETE /api/notices/:noticeId` - Delete notice

## 🎨 Features in Detail

### QR Code Attendance System:
- Each gym gets a unique QR code
- Members scan to mark attendance
- Google Pay-style success animation
- Automatic check-in/check-out tracking
- Real-time attendance dashboard

### Automated Notifications:
- Membership expiring in 7 days
- Members inactive for 3+ days
- Subscription renewal reminders
- Payment confirmations

### Referral System:
- Unique code for each user
- ₹200 earnings per successful referral
- ₹200 discount for new customers
- Track total referral earnings

## 🐛 Troubleshooting

### MongoDB Connection Error:
```bash
# Start MongoDB
sudo systemctl start mongod

# Check MongoDB status
sudo systemctl status mongod
```

### Port Already in Use:
```bash
# Kill process on port 5000
sudo lsof -t -i:5000 | xargs kill -9

# Or change port in backend/.env
PORT=5001
```

### Camera Access Denied (QR Scanner):
- Enable camera permissions in browser
- Use HTTPS in production
- Check browser compatibility

## 🚀 Deployment

### Backend (on VPS/Cloud):
1. Set up MongoDB
2. Configure environment variables
3. Install PM2: `npm install -g pm2`
4. Run: `pm2 start server.js`

### Frontend (Netlify/Vercel):
1. Build: `npm run build`
2. Deploy `build` folder
3. Configure environment variables

## 📝 Future Enhancements

- [ ] SMS notifications
- [ ] Email notifications
- [ ] Payment gateway integration
- [ ] Mobile app (React Native)
- [ ] Workout plans management
- [ ] Diet tracking
- [ ] Progress photos
- [ ] Biometric attendance
- [ ] Multi-gym franchise support

## 👥 Support

For issues or questions:
- Create an issue on GitHub
- Email: support@gymmate.com
- Phone: +91-XXXXXXXXXX

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

Built with ❤️ for gym owners who want to focus on fitness, not paperwork!

---

**GymMate** - Making Gym Management Simple! 💪
