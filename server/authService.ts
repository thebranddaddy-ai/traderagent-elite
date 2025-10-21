import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { db } from "./db";
import { otpCodes, users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

// Generate 6-digit OTP code
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send Email OTP (via Resend)
export async function sendEmailOTP(email: string, code: string): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TraderAgent Elite <noreply@yourdomain.com>",
      to: email,
      subject: "Your Login Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your Login Code</h2>
          <p>Your verification code is:</p>
          <h1 style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px;">${code}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

// Send Phone OTP (via Twilio)
export async function sendPhoneOTP(phone: string, code: string): Promise<void> {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Body: `Your TraderAgent Elite login code is: ${code}. Valid for 10 minutes.`,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send SMS: ${error}`);
  }
}

// Store OTP in database
export async function storeOTP(
  identifier: string,
  code: string,
  type: "email" | "phone",
  userId?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(otpCodes).values({
    userId,
    identifier,
    code,
    type,
    expiresAt,
  });
}

// Verify OTP code
export async function verifyOTP(
  identifier: string,
  code: string,
  type: "email" | "phone"
): Promise<boolean> {
  const now = new Date();

  const [otpRecord] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.identifier, identifier),
        eq(otpCodes.code, code),
        eq(otpCodes.type, type),
        gt(otpCodes.expiresAt, now),
        eq(otpCodes.verified, false)
      )
    )
    .limit(1);

  if (!otpRecord) {
    return false;
  }

  // Mark as verified
  await db
    .update(otpCodes)
    .set({ verified: true })
    .where(eq(otpCodes.id, otpRecord.id));

  return true;
}

// Generate TOTP secret for Google Authenticator
export async function generateTOTPSecret(userId: string, email: string) {
  const secret = speakeasy.generateSecret({
    name: `TraderAgent Elite (${email})`,
    issuer: "TraderAgent Elite",
  });

  // Store secret in database
  await db
    .update(users)
    .set({ 
      totpSecret: secret.base32,
      totpEnabled: false // User must verify before enabling
    })
    .where(eq(users.id, userId));

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
  };
}

// Verify TOTP code
export async function verifyTOTP(userId: string, token: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.totpSecret) {
    return false;
  }

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: "base32",
    token,
    window: 2, // Allow 2 time steps before/after (60 seconds tolerance)
  });

  return verified;
}

// Enable TOTP after verification
export async function enableTOTP(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ totpEnabled: true })
    .where(eq(users.id, userId));
}

// Disable TOTP
export async function disableTOTP(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ 
      totpEnabled: false,
      totpSecret: null 
    })
    .where(eq(users.id, userId));
}
