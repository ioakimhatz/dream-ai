// api/send-otp.js - COMPLETE FILE WITH BIGGER LOGO
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`Generating OTP ${otp} for ${email}`);

        // Your Resend API key
        const RESEND_API_KEY = '***REMOVED***';

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Dream AI <support@dream-ai.app>',
                to: email,
                subject: 'Your Dream AI Login Code',
                html: `
          <div style="font-family: -apple-system, Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="text-align: center; padding: 40px 20px;">
              <img src="https://i.imgur.com/RmsM402.png" alt="Dream AI" style="width: 250px; height: 80px; margin-bottom: 20px; border-radius: 16px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 600; color: #1a1a1a;">Welcome to Dream AI!</h1>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #666;">Your 4-digit login code is:</p>
              <div style="font-size: 48px; font-weight: 700; letter-spacing: 10px; color: #1a1a1a; padding: 20px; background: #f8f9fa; border-radius: 12px; margin: 0 0 30px 0;">
                ${otp}
              </div>
              <p style="margin: 0; font-size: 14px; color: #999;">This code expires in 10 minutes</p>
            </div>
          </div>
        `,
            }),
        });

        const data = await response.json();
        console.log('Resend Response:', data);

        if (!response.ok) {
            console.error('Resend Error:', data);
            return res.status(400).json({
                error: 'Failed to send email',
                details: data.message || data.error
            });
        }

        if (data.id) {
            console.log('Email sent successfully with ID:', data.id);
            return res.status(200).json({
                success: true,
                otp: otp,
                message: 'OTP sent successfully to ' + email
            });
        }

        return res.status(400).json({
            error: 'Unexpected response from email service',
            details: data
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}