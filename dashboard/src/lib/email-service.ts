import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined, // Use IAM role in production
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@leadspot.ai';

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;

  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Reset your LeadSpot password' },
      Body: {
        Html: {
          Data: `
            <h2>Reset your password</h2>
            <p>Click the link below to reset your LeadSpot password. This link expires in 1 hour.</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you didn't request this, ignore this email.</p>
          `,
        },
        Text: {
          Data: `Reset your LeadSpot password:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
        },
      },
    },
  }));
}

export async function sendWalletLowBalance(ownerEmail: string, balance: number): Promise<void> {
  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [ownerEmail] },
    Message: {
      Subject: { Data: '[LeadSpot] Low wallet balance alert' },
      Body: {
        Html: {
          Data: `
            <h2>Low Balance Alert</h2>
            <p>Your LeadSpot wallet balance is low: <strong>$${balance.toFixed(2)}</strong></p>
            <p>Your voice agents will be automatically paused when the balance reaches $0.</p>
            <p><a href="${process.env.NEXTAUTH_URL}/billing">Top up your wallet →</a></p>
          `,
        },
        Text: {
          Data: `Low Balance Alert\n\nYour LeadSpot wallet balance is $${balance.toFixed(2)}.\nVoice agents pause at $0.\n\nTop up: ${process.env.NEXTAUTH_URL}/billing`,
        },
      },
    },
  }));
}

export async function sendTenantWelcome(ownerEmail: string, slug: string): Promise<void> {
  const dashboardUrl = `${process.env.NEXTAUTH_URL}/t/${slug}`;

  await ses.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [ownerEmail] },
    Message: {
      Subject: { Data: 'Welcome to LeadSpot — Your account is ready' },
      Body: {
        Html: {
          Data: `
            <h2>Welcome to LeadSpot!</h2>
            <p>Your account <strong>${slug}</strong> has been provisioned and is ready to use.</p>
            <p><a href="${dashboardUrl}">Access your dashboard →</a></p>
            <p>Your Mautic marketing automation instance will be ready within a few minutes.</p>
          `,
        },
        Text: {
          Data: `Welcome to LeadSpot!\n\nYour account ${slug} is ready.\n\nDashboard: ${dashboardUrl}`,
        },
      },
    },
  }));
}
