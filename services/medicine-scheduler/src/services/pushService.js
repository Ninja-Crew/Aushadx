import admin from 'firebase-admin';
import axios from 'axios';

import fs from 'fs';
import path from 'path';

// Check for service account file path via env or default to root of service
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve('./service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[PUSH SERVICE] Firebase Admin initialized with service-account.json');
    } else {
      console.warn(`[PUSH SERVICE] WARNING: service-account.json not found at ${serviceAccountPath}. Push notifications will fail or mock mode will run if admin is not initialized.`);
      // Fallback to application default just in case it's in a GCP environment
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
    }
  } catch (err) {
    console.error('[PUSH SERVICE] Firebase Admin init failed:', err.message);
  }
}

const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || "http://localhost:3001";

export const sendPushNotification = async (userId, message, reminderId) => {
  try {
    console.log(`[PUSH SERVICE] Sending notification to user ${userId}: ${message}`);
    
    // 1. Fetch user's FCM tokens from Profile Manager
    // Since medicine-scheduler doesn't have the JWT token here, it uses an internal service call.
    // Ensure Profile Manager allows this or bypasses auth for internal requests.
    const response = await axios.get(`${PROFILE_SERVICE_URL}/profile/${userId}?internal=true`);
    const user = response.data.data?.user || response.data.user;
    
    const tokens = user?.fcmTokens || [];
    if (tokens.length === 0) {
      console.log(`[PUSH SERVICE] User ${userId} has no FCM tokens.`);
      return { success: false, reason: 'No tokens' };
    }

    // 2. Dispatch FCM Data Messages via Firebase Admin
    if (admin.apps.length > 0) {
      const payload = {
        tokens,
        data: {
          title: 'Medicine Reminder',
          body: message,
          reminderId: reminderId ? reminderId.toString() : '',
          actions: JSON.stringify([
            { title: 'Take', pressAction: { id: 'take' } },
            { title: 'Snooze', pressAction: { id: 'snooze' } }
          ])
        }
      };
      
      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`[PUSH SERVICE] FCM send responses: ${response.successCount} success, ${response.failureCount} failures`);
      
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            console.error(`[PUSH SERVICE] Failure for token ${tokens[idx]}:`, error);

            // Check if the token is invalid or expired
            if (error && error.errorInfo && [
              'messaging/invalid-registration-token',
              'messaging/registration-token-not-registered',
              'messaging/mismatched-credential'
            ].includes(error.errorInfo.code)) {
              failedTokens.push(tokens[idx]);
            }
          }
        });

        // Remove failed invalid tokens from the user's profile
        if (failedTokens.length > 0) {
           console.log(`[PUSH SERVICE] Removing ${failedTokens.length} dead tokens for user ${userId}`);
           for (const token of failedTokens) {
              try {
                await axios.patch(`${PROFILE_SERVICE_URL}/profile/fcm-token/${userId}?internal=true`, {
                   token: token,
                   action: 'remove'
                });
              } catch (e) {
                console.error(`[PUSH SERVICE] Failed to remove dead token ${token} for user ${userId}:`, e.message);
              }
           }
        }
      }

      return { success: true, timestamp: new Date(), fcmResponse: response };
    } else {
      console.log(`[PUSH SERVICE] Mock FCM Multicast to ${tokens.length} devices.`);
      return { success: true, timestamp: new Date(), mock: true };
    }
  } catch (error) {
    console.error(`[PUSH SERVICE] Error sending notification:`, error.message);
    return { success: false, error: error.message };
  }
};
