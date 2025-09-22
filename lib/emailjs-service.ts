import { Alert } from 'react-native';

export class EmailService {
  // THIS IS YOUR WORKING URL - TESTED AND CONFIRMED!
  private static VERCEL_API_URL = 'https://dreamverse-fresh-hkgta9kz4-dream-ais-projects-80e70262.vercel.app/api/send-otp';
  
  static async sendOTP(email: string): Promise<{ success: boolean; otp?: string; error?: string }> {
    try {
      console.log('Sending OTP to:', email);
      console.log('Using API URL:', this.VERCEL_API_URL);
      
      const response = await fetch(this.VERCEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log('Response from API:', data);

      if (data.success) {
        return { success: true, otp: data.otp };
      } else {
        return { success: false, error: data.error || 'Failed to send OTP' };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }
}
