#!/bin/bash
# Quick Start Script for iOS & Android Testing

set -e  # Exit on error

PROJECT_ROOT="/Users/moudy/Desktop/g000st"

echo "🚀 g000st Mobile App - Quick Start"
echo "=================================="
echo ""

cd "$PROJECT_ROOT"

# Function to start backend
start_backend() {
  echo "▶️  Starting backend services..."
  pkill -f "node.*server.js\|node.*unified.js" || true
  sleep 1
  
  PORT=3001 node backend/g000st-web/server.js >/tmp/3001.log 2>&1 &
  PORT=3002 node backend/g000st-app/unified.js >/tmp/3002.log 2>&1 &
  PORT=3003 node backend/g000st-app/server.js >/tmp/3003.log 2>&1 &
  
  sleep 2
  
  echo "✓ Backend services running:"
  echo "  - Port 3001: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/feed)"
  echo "  - Port 3002: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/ || echo 'N/A')"
  echo "  - Port 3003: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/health || echo 'N/A')"
  echo ""
}

# Function to open Xcode
open_xcode() {
  echo "📱 Opening Xcode for iOS development..."
  open ios/App/App.xcodeproj
  sleep 2
  echo "✓ Xcode opened"
  echo ""
}

# Function to open Android Studio
open_android_studio() {
  echo "🤖 Opening Android Studio for Android development..."
  open -a "Android Studio" android 2>/dev/null || {
    echo "⚠️  Android Studio not found. Opening manually:"
    echo "   Applications → Android Studio → Open Project: $PROJECT_ROOT/android"
  }
  sleep 2
  echo "✓ Android Studio opened"
  echo ""
}

# Function to show next steps
show_next_steps() {
  echo "📋 Next Steps:"
  echo ""
  echo "iOS (Xcode):"
  echo "  1. Select 'App' scheme (top left)"
  echo "  2. Select simulator: iPhone 15 (or any)"
  echo "  3. Press ⌘R to build and run"
  echo ""
  echo "Android (Android Studio):"
  echo "  1. Wait for Gradle sync to complete"
  echo "  2. Run → Select emulator"
  echo "  3. Wait for app to install and launch"
  echo ""
  echo "Testing:"
  echo "  - App should load profile/feed screen"
  echo "  - Try Chat, Social, Contacts tabs"
  echo "  - Admin page: $PROJECT_ROOT/web/admin.html (if backend running)"
  echo ""
}

# Menu
echo "Choose what to do:"
echo "  1) Start backend services"
echo "  2) Open Xcode (iOS)"
echo "  3) Open Android Studio"
echo "  4) Do all (1+2+3)"
echo "  5) Show next steps"
echo "  0) Exit"
echo ""
read -p "Enter choice (0-5): " choice

case $choice in
  1) start_backend ;;
  2) open_xcode ;;
  3) open_android_studio ;;
  4) 
    start_backend
    open_xcode
    open_android_studio
    ;;
  5) show_next_steps ;;
  0) echo "Exiting."; exit 0 ;;
  *) echo "Invalid choice"; exit 1 ;;
esac

show_next_steps
