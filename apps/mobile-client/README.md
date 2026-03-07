# AushadX Mobile Client

The Mobile Client for AushadX, built with React Native and Expo. It provides users with a comprehensive dashboard to interact with the AushadX ecosystem, including managing their profile, scheduling personalized medicine reminders, analyzing drug information, and conversing with an AI health assistant.

## Prerequisites

- Node.js (v20+ recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)

## Getting Started

1. **Install Dependencies**
   ```bash
   cd apps/mobile-client
   npm install
   ```

2. **Environment Configuration**
   Copy the `.env.example` file to create your own configuration:
   ```bash
   cp .env.example .env
   ```
   *Note: If you are running the app on a physical Android device, you must replace `localhost` in the `.env` file with your computer's local IPv4 address (e.g., `http://192.168.1.10:3000`). If you are running on iOS simulator or a web browser, `localhost` works fine.*

3. **Run the Application**

   Start the Expo development server:
   ```bash
   npm start
   ```
   
   From the Expo terminal, you can press:
   - `a` to open on an Android Emulator or connected device
   - `i` to open on an iOS Simulator
   - `w` to open in a local web browser

## Key Features

- **Authentication**: Sign up and login using JWT strategies routing through the API Gateway to the Profile Manager.
- **Profile Manager**: View and manage user details, including medical information like blood type, height, weight, and allergies.
- **Medicine Reminders**: A full interface to view, create, and edit complex medicine schedules (e.g., everyday, specific days of the month, continuously, or for X days).
- **Intelligent Analysis**: Identify information about pills and drugs through text analysis.
- **AI Health Companion**: Chat directly with the AushadX AI Agent.

## Project Structure

```text
apps/mobile-client/
├── assets/             # Images and icons
├── src/
│   ├── api/            # API clients using Axios for microservices communication
│   ├── components/     # Reusable UI components
│   ├── navigation/     # React Navigation stacks
│   ├── screens/        # Main application screens (Dashboard, Login, Reminders, etc.)
│   ├── styles/         # Global typography, spacing, and unified colors
│   └── utils/          # Storage helpers (AsyncStorage/SecureStore)
├── App.js              # Application entry point
├── app.json            # Expo configuration
└── .env                # Environment variables
```
