import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface RoomInviteData {
    toEmail: string;
    toName: string;
    fromName: string;
    movieTitle: string;
    roomCode?: string;
    roomId: string;
}

export const emailService = {
    sendRoomInvite: async (data: RoomInviteData): Promise<boolean> => {
        try {
            const joinUrl = `${process.env.FRONTEND_URL}/join/${data.roomId}?invite=true`;

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #0D0D0F; color: #ffffff; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a1f 0%, #0D0D0F 100%); border-radius: 24px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
                        .header { text-align: center; margin-bottom: 32px; }
                        .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #695CFF 0%, #8B7FFF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                        .content { text-align: center; }
                        .movie-title { font-size: 24px; font-weight: bold; margin: 24px 0; color: #ffffff; }
                        .message { font-size: 16px; color: rgba(255,255,255,0.7); margin: 16px 0; line-height: 1.6; }
                        .button { display: inline-block; background: linear-gradient(135deg, #695CFF 0%, #8B7FFF 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 16px; font-weight: bold; font-size: 16px; margin: 24px 0; box-shadow: 0 8px 24px rgba(105, 92, 255, 0.3); }
                        .button:hover { box-shadow: 0 12px 32px rgba(105, 92, 255, 0.4); }
                        .room-code { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; margin: 24px 0; border: 1px solid rgba(255,255,255,0.1); }
                        .code { font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #695CFF; }
                        .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">ConnectUS</div>
                        </div>
                        <div class="content">
                            <p class="message">Hey ${data.toName}! 👋</p>
                            <p class="message"><strong>${data.fromName}</strong> invited you to watch</p>
                            <div class="movie-title">🎬 ${data.movieTitle}</div>
                            <p class="message">Join the watch party and enjoy the movie together!</p>
                            <a href="${joinUrl}" class="button">Join Now 🍿</a>
                            ${data.roomCode ? `
                                <div class="room-code">
                                    <p style="margin: 0 0 8px 0; font-size: 14px; color: rgba(255,255,255,0.6);">Room Code</p>
                                    <div class="code">${data.roomCode}</div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="footer">
                            <p>See you there! 🎉</p>
                            <p>ConnectUS - Watch Together, Anywhere</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await resend.emails.send({
                from: 'ConnectUS <invites@connectus.app>',
                to: data.toEmail,
                subject: `${data.fromName} invited you to watch ${data.movieTitle}!`,
                html: htmlContent,
            });

            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    },

    sendPasswordReset: async (toEmail: string, toName: string, resetToken: string): Promise<boolean> => {
        try {
            const resetUrl = `${process.env.FRONTEND_URL || 'https://connectus.live'}/reset-password?token=${resetToken}`;

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #0D0D0F; color: #ffffff; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a1f 0%, #0D0D0F 100%); border-radius: 24px; padding: 40px; border: 1px solid rgba(255,255,255,0.1); }
                        .header { text-align: center; margin-bottom: 32px; }
                        .logo { font-size: 32px; font-weight: bold; background: linear-gradient(135deg, #695CFF 0%, #8B7FFF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                        .content { text-align: center; }
                        .title { font-size: 24px; font-weight: bold; margin: 24px 0; color: #ffffff; }
                        .message { font-size: 16px; color: rgba(255,255,255,0.7); margin: 16px 0; line-height: 1.6; }
                        .button { display: inline-block; background: linear-gradient(135deg, #695CFF 0%, #8B7FFF 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 16px; font-weight: bold; font-size: 16px; margin: 24px 0; box-shadow: 0 8px 24px rgba(105, 92, 255, 0.3); }
                        .button:hover { box-shadow: 0 12px 32px rgba(105, 92, 255, 0.4); }
                        .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); font-size: 14px; }
                        .warning { background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); padding: 16px; border-radius: 12px; margin: 24px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">ConnectUS</div>
                        </div>
                        <div class="content">
                            <p class="message">Hey ${toName}! 👋</p>
                            <div class="title">🔐 Reset Your Password</div>
                            <p class="message">We received a request to reset your password. Click the button below to create a new password:</p>
                            <a href="${resetUrl}" class="button">Reset Password</a>
                            <div class="warning">
                                <p style="margin: 0; font-size: 14px; color: rgba(255, 193, 7, 0.9);">⚠️ This link will expire in 1 hour</p>
                            </div>
                            <p class="message" style="font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>Stay secure! 🔒</p>
                            <p>ConnectUS - Watch Together, Anywhere</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await resend.emails.send({
                from: 'ConnectUS <noreply@connectus.app>',
                to: toEmail,
                subject: 'Reset Your ConnectUS Password',
                html: htmlContent,
            });

            return true;
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return false;
        }
    },
};
