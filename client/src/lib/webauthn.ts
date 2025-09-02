import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export interface BiometricDevice {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * Check if WebAuthn is supported by the browser
 */
export function isWebAuthnSupported(): boolean {
  return !!window.PublicKeyCredential;
}

/**
 * Check if the device has biometric capabilities
 */
export async function isBiometricSupported(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    // Check if platform authenticators are available (Touch ID, Face ID, Windows Hello, etc.)
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return false;
  }
}

/**
 * Register a new biometric authenticator for the current user
 */
export async function registerBiometric(deviceName?: string): Promise<void> {
  try {
    // Start the registration process
    const registrationOptionsResponse = await fetch('/api/auth/webauthn/register/begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!registrationOptionsResponse.ok) {
      const error = await registrationOptionsResponse.json();
      throw new Error(error.error || 'Failed to start biometric registration');
    }

    const registrationOptions = await registrationOptionsResponse.json();

    // Use SimpleWebAuthn to handle the browser WebAuthn API
    const registrationResponse = await startRegistration(registrationOptions);

    // Send the response to the server for verification
    const verificationResponse = await fetch('/api/auth/webauthn/register/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: registrationResponse,
        deviceName: deviceName || 'Biometric Device',
      }),
    });

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      throw new Error(error.error || 'Failed to complete biometric registration');
    }

    const result = await verificationResponse.json();
    if (!result.verified) {
      throw new Error('Biometric registration verification failed');
    }
  } catch (error) {
    console.error('Biometric registration error:', error);
    throw error;
  }
}

/**
 * Authenticate using biometric credentials
 */
export async function authenticateWithBiometric(email: string): Promise<{ user: any; message: string }> {
  try {
    // Start the authentication process
    const authOptionsResponse = await fetch('/api/auth/webauthn/login/begin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!authOptionsResponse.ok) {
      const error = await authOptionsResponse.json();
      throw new Error(error.error || 'Failed to start biometric authentication');
    }

    const authOptions = await authOptionsResponse.json();

    // Use SimpleWebAuthn to handle the browser WebAuthn API
    const authResponse = await startAuthentication(authOptions);

    // Send the response to the server for verification
    const verificationResponse = await fetch('/api/auth/webauthn/login/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: authResponse,
      }),
    });

    if (!verificationResponse.ok) {
      const error = await verificationResponse.json();
      throw new Error(error.error || 'Failed to complete biometric authentication');
    }

    const result = await verificationResponse.json();
    if (!result.verified) {
      throw new Error('Biometric authentication verification failed');
    }

    return result;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    throw error;
  }
}

/**
 * Get list of registered biometric devices for the current user
 */
export async function getBiometricDevices(): Promise<BiometricDevice[]> {
  try {
    const response = await fetch('/api/auth/webauthn/authenticators');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get biometric devices');
    }

    return await response.json();
  } catch (error) {
    console.error('Get biometric devices error:', error);
    throw error;
  }
}

/**
 * Remove a biometric device
 */
export async function removeBiometricDevice(credentialId: string): Promise<void> {
  try {
    const response = await fetch(`/api/auth/webauthn/authenticators/${credentialId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove biometric device');
    }
  } catch (error) {
    console.error('Remove biometric device error:', error);
    throw error;
  }
}

/**
 * Get a user-friendly device name based on the browser/platform
 */
export function getDeviceName(): string {
  const userAgent = navigator.userAgent;
  
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'iPhone/iPad (Touch ID/Face ID)';
  } else if (/Mac/i.test(userAgent)) {
    return 'Mac (Touch ID)';
  } else if (/Android/i.test(userAgent)) {
    return 'Android (Fingerprint)';
  } else if (/Windows/i.test(userAgent)) {
    return 'Windows (Windows Hello)';
  } else {
    return 'Biometric Device';
  }
}

/**
 * Handle WebAuthn errors and provide user-friendly messages
 */
export function getWebAuthnErrorMessage(error: any): string {
  const message = error.message || error.toString();
  
  if (message.includes('NotAllowedError') || message.includes('User cancelled')) {
    return 'Biometric authentication was cancelled. Please try again.';
  } else if (message.includes('NotSupportedError')) {
    return 'Biometric authentication is not supported on this device.';
  } else if (message.includes('SecurityError')) {
    return 'Security error during biometric authentication. Please ensure you\'re using a secure connection.';
  } else if (message.includes('InvalidStateError')) {
    return 'A biometric authenticator is already registered for this device.';
  } else if (message.includes('UnknownError')) {
    return 'An unknown error occurred during biometric authentication.';
  } else if (message.includes('AbortError')) {
    return 'Biometric authentication was interrupted. Please try again.';
  } else {
    return message || 'An error occurred during biometric authentication.';
  }
}