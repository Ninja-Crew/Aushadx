# AushadX Mobile Client Test Scenarios

This document outlines the test coverage for the AushadX React Native mobile client. The testing strategy is divided into three tiers: Unit Tests, Component Tests, and Integration Tests. All tests are automated using Jest and React Native Testing Library.

## 1. Unit Tests

Unit tests focus on the core business logic, API communication, context state management, and utility functions without rendering React Native components.

### 1.1 API Modules (`tests/unit/api`)
- **`auth.test.js`**:
  - `login`: Verifies successful token extraction and validation, handles 401 Unauthorized errors, handles generic network/server errors.
  - `signup`: Validates correct payload submission during registration.
  - `verifyOTP`: Verifies standard OTP submission logic and token generation.
  - `resendOTP`: Verifies correct API invocation for requesting a new OTP.
  - `refreshTokenCall`: Verifies that access and refresh tokens are correctly renewed.
- **`profile.test.js`**:
  - `getProfile`: Ensures profile data is retrieved using the correct authorization headers.
  - `updateProfile`: Validates payload formatting when updating user data.
  - `registerFCMToken`: Ensures the FCM token is sent to the backend correctly.
- **`reminders.test.js`**:
  - `getReminders`: Checks retrieval of all active reminders.
  - `getMissedReminders`: Checks retrieval of the missed reminders list.
  - `createReminder`: Verifies POST requests for new reminder schedules.
  - `updateReminder`: Verifies PUT requests for updating existing schedules.
  - `deleteReminder`: Verifies DELETE requests for schedule removal.
  - `takeReminder`, `snoozeReminder`: Validates state-change requests for specific reminder occurrences.
- **`agent.test.js`**:
  - `startChatSession`: Validates creation of a new medical agent chat session.
  - `sendMessage`: Verifies correct message payload and response handling.
  - `getChatHistory`: Checks retrieval of paginated chat logs.
- **`analyzer.test.js`**:
  - `analyzeMedicine`: Verifies correct handling of multi-modal (text/image) payloads sent to the backend analyzer.
- **`client.test.js`**:
  - Validates `axios` request interceptors, ensuring authorization headers are correctly appended before outgoing requests.

### 1.2 Utilities & Context (`tests/unit/utils`, `tests/unit/context`)
- **`storage.test.js`**:
  - Checks secure token storage (`saveToken`), retrieval (`getToken`, `getRefreshToken`), and deletion (`removeToken`) using mocked `Expo SecureStore` and `AsyncStorage`.
- **`ThemeContext.test.js`**:
  - Verifies the `ThemeContext` provider correctly toggles between light and dark themes and persists preference to `AsyncStorage`.
- **`NotificationContext.test.js`**:
  - Ensures the `NotificationContext` provider correctly initializes, loads notifications, and properly manages unread count state.

---

## 2. Component Tests

Component tests verify that individual UI elements and entire screens render correctly and handle user interactions as expected in isolation.

### 2.1 UI Elements (`tests/component/components`)
- **`CustomHeader.test.js`**:
  - Verifies proper rendering of the title and SOS button.
  - Ensures the unread notification badge is displayed when counts are > 0.
  - Validates `Linking.openURL` execution when the SOS button is pressed.
- **`ChatMessage.test.js`**:
  - Checks rendering of user messages and agent responses.
  - Validates markdown styling extraction (e.g., bold text).
  - Ensures status messages (queued, tool execution) render appropriate text labels.
- **`BootSplash.test.js`**:
  - Verifies the initial render of the "AushadX" logo and tagline.
- **`AnalysisResultModal.test.js`**:
  - Validates correct rendering of medicine details (dosage, side effects, confidence score).
  - Ensures modal behavior toggles correctly upon closing and correctly fires schedule callbacks.

### 2.2 Screens (`tests/component/screens`)
- **`LoginScreen.test.js`**: Verifies rendering of email/password inputs and "Sign In" button; checks navigation handlers for Sign Up and Forgot Password.
- **`HomeScreen.test.js`**: Verifies rendering of the "Quick Actions" panel and primary dashboard layout.
- **`ProfileScreen.test.js`**: Verifies successful render state without crashing.
- **`RemindersScreen.test.js`**: Verifies rendering of the missed and upcoming reminder list interface.
- **`AddEditReminderScreen.test.js`**: Checks that the complex form renders "Medicine Name" and "Dosage" inputs properly.
- **`AgentScreen.test.js`**: Ensures the chat input field ("Ask about your medicines...") and basic layout render correctly.
- **`NearbyHospitalsScreen.test.js`**: Checks that the loading state ("Finding nearby medical facilities...") renders correctly before map initialization.
- **`ScheduleScreen.test.js`**: Verifies the "Coming Soon" placeholder renders properly.

---

## 3. Integration Tests

Integration tests ensure multiple components and context providers work together harmoniously, simulating realistic user flows.

### 3.1 Navigation (`tests/integration/navigation.test.js`)
- Verifies that `AppNavigator` renders the `BootSplash` component during the initial bootstrapping phase while verifying tokens.

### 3.2 Authentication Flow (`tests/integration/flows/authFlow.test.js`)
- Simulates user input for credentials on the `LoginScreen`.
- Triggers the "Login" button.
- Verifies that the API `login` function is invoked with the correct arguments.
- Ensures the application dispatches a navigation event to `MainTabs` upon successful login.

### 3.3 Reminder Creation Flow (`tests/integration/flows/reminderFlow.test.js`)
- Renders the `AddEditReminderScreen`.
- Simulates text input for medicine name ("Ibuprofen") and dosage ("200mg").
- Triggers the "Save Reminder" action.
- Validates that the underlying `remindersApi.createReminder` function is called and the user is successfully navigated back to the previous screen.

---

*Note: All tests successfully mock out physical device capabilities (like Maps, Location, Push Notifications, and Secure Storage) and external network requests to guarantee isolated, deterministic test environments.*
