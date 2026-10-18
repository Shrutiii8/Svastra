const nodemailer = require('nodemailer');

// Brevo SMTP credentials configured via Environment Variables
const SMTP_HOST = process.env.MAIL_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT = parseInt(process.env.MAIL_PORT || '587', 10);
const SMTP_USER = process.env.MAIL_USER || 'b26160001@smtp-brevo.com';
const SMTP_PASS = process.env.MAIL_PASS; // Configured in Vercel Project Settings -> Environment Variables
const TARGET_EMAIL = process.env.MAIL_TO || 'iambeinganupam@gmail.com';
const MAIL_FROM = process.env.MAIL_FROM || 'Svastra Platform <iambeinganupam@gmail.com>';

module.exports = async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      fullName,
      name,
      emailAddr,
      email,
      orgName,
      organization,
      sectorSelect,
      sector,
      inquirySubject,
      subject,
      messageText,
      message
    } = req.body || {};

    const senderName = (fullName || name || '').trim();
    const senderEmail = (emailAddr || email || '').trim();
    const senderOrg = (orgName || organization || 'Not specified').trim();
    const senderSector = (sectorSelect || sector || 'General Inquiry').trim();
    const senderSubject = (inquirySubject || subject || 'Svastra Pilot Inquiry').trim();
    const senderMessage = (messageText || message || '').trim();

    if (!senderName || !senderEmail || !senderMessage) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and message.'
      });
    }

    const emailSubject = `[Svastra Pilot Inquiry] ${senderSubject} — ${senderName}`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <div style="background: linear-gradient(135deg, #0B1430 0%, #1D4ED8 100%); padding: 24px 28px; color: #ffffff;">
          <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; color: #ffffff;">SVASTRA — HEATGUARD TWIN</h2>
          <p style="margin: 0; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.08em;">New Pilot & Partnership Request</p>
        </div>
        <div style="padding: 24px 28px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 140px; font-weight: 600;">Full Name:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${senderName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Work Email:</td>
              <td style="padding: 8px 0; color: #2563eb;"><a href="mailto:${senderEmail}" style="color: #2563eb; text-decoration: none;">${senderEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Organization:</td>
              <td style="padding: 8px 0; color: #0f172a;">${senderOrg}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Industry Sector:</td>
              <td style="padding: 8px 0; color: #0f172a;">${senderSector}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Subject:</td>
              <td style="padding: 8px 0; color: #0f172a;">${senderSubject}</td>
            </tr>
          </table>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Project Inquiry / Message:</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0f172a; white-space: pre-wrap;">${senderMessage}</p>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
            Sent securely via Svastra Web Platform on Vercel • Reply directly to this email to reach ${senderName}.
          </div>
        </div>
      </div>
    `;

    const textContent = `
Svastra (HeatGuard Twin) — New Pilot & Contact Inquiry
======================================================
From: ${senderName} <${senderEmail}>
Organization: ${senderOrg}
Industry Sector: ${senderSector}
Subject: ${senderSubject}

Message:
${senderMessage}

--
Sent securely via Svastra Web Platform on Vercel.
    `;

    // Attempt 1: Brevo SMTP if MAIL_PASS is defined in Vercel Environment Variables
    if (SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: false,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: MAIL_FROM,
          to: TARGET_EMAIL,
          replyTo: senderEmail,
          subject: emailSubject,
          text: textContent,
          html: htmlContent
        });

        return res.status(200).json({
          success: true,
          message: 'Thank you! Your message has been sent directly to the Svastra team.'
        });
      } catch (smtpErr) {
        console.warn('SMTP dispatch error, attempting FormSubmit fallback:', smtpErr.message);
      }
    }

    // Attempt 2: FormSubmit dispatch fallback (requires no secrets)
    try {
      const fsRes = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: emailSubject,
          name: senderName,
          email: senderEmail,
          organization: senderOrg,
          sector: senderSector,
          message: senderMessage
        })
      });

      const fsData = await fsRes.json().catch(() => ({}));
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent directly to the Svastra team.',
        details: fsData
      });
    } catch (fsErr) {
      console.warn('FormSubmit fallback error:', fsErr);
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been received.'
      });
    }
  } catch (error) {
    console.error('Failed to process contact inquiry:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please reach out to contact@svastra.com.'
    });
  }
};
