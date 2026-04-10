#!/bin/bash

echo "🏋️ GymMate Setup Script 🏋️"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB not found!${NC}"
    echo "Installing MongoDB..."
    
    # For Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y mongodb
        sudo systemctl start mongod
        sudo systemctl enable mongod
        echo -e "${GREEN}✅ MongoDB installed and started${NC}"
    else
        echo -e "${RED}❌ Please install MongoDB manually${NC}"
        echo "Visit: https://docs.mongodb.com/manual/installation/"
        exit 1
    fi
else
    echo -e "${GREEN}✅ MongoDB found${NC}"
    # Start MongoDB if not running
    sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /var/log/mongodb.log 2>/dev/null
    echo -e "${GREEN}✅ MongoDB started${NC}"
fi

echo ""
echo "📦 Setting up Backend..."
echo "========================"

cd backend

# Install backend dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${YELLOW}Backend dependencies already installed${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating backend .env file..."
    cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gymmate
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=development

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EOF
    echo -e "${GREEN}✅ Backend .env created${NC}"
else
    echo -e "${YELLOW}.env already exists${NC}"
fi

cd ..

echo ""
echo "🎨 Setting up Frontend..."
echo "========================="

cd frontend

# Install frontend dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}Frontend dependencies already installed${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating frontend .env file..."
    cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000/api
EOF
    echo -e "${GREEN}✅ Frontend .env created${NC}"
else
    echo -e "${YELLOW}.env already exists${NC}"
fi

cd ..

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "=============================="
echo "🚀 How to Run GymMate:"
echo "=============================="
echo ""
echo "1️⃣  Start Backend (Terminal 1):"
echo "   cd backend && npm start"
echo ""
echo "2️⃣  Start Frontend (Terminal 2):"
echo "   cd frontend && npm start"
echo ""
echo "3️⃣  Open in browser:"
echo "   http://localhost:3000"
echo ""
echo "=============================="
echo "📚 Default Accounts:"
echo "=============================="
echo ""
echo "Create your gym owner account through registration"
echo "Get 3 days FREE trial!"
echo ""
echo -e "${GREEN}Happy Gym Managing! 💪${NC}"
