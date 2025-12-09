package com.example.booking.service.impl;

import com.example.booking.service.EmailService;
import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    private final SendGrid sendGrid;
    private final String fromEmail;
    private final String fromName;
    private final String resetPasswordUrl;

    public EmailServiceImpl(
            @Value("${sendgrid.api-key:}") String apiKey,
            @Value("${sendgrid.from-email:noreply@myapp.com}") String fromEmail,
            @Value("${sendgrid.from-name:MyApp}") String fromName,
            @Value("${app.reset-password.url:myapp://reset-password}") String resetPasswordUrl) {
        try {
            if (apiKey == null || apiKey.trim().isEmpty()) {
                log.warn("⚠️ SendGrid API key is not configured. Email sending will fail.");
                this.sendGrid = null;
            } else {
                this.sendGrid = new SendGrid(apiKey.trim());
                log.info("✅ SendGrid initialized successfully");
            }
        } catch (Exception e) {
            log.error("❌ Failed to initialize SendGrid: {}", e.getMessage(), e);
            this.sendGrid = null;
        }
        
        // Initialize email configuration (these are safe to set regardless of SendGrid initialization)
        this.fromEmail = fromEmail != null ? fromEmail.trim() : "noreply@myapp.com";
        this.fromName = fromName != null ? fromName.trim() : "MyApp";
        this.resetPasswordUrl = resetPasswordUrl != null ? resetPasswordUrl.trim() : "myapp://reset-password";
        log.info("📧 EmailServiceImpl initialized - From: {} <{}>, Reset URL: {}", this.fromName, this.fromEmail, this.resetPasswordUrl);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        try {
            // Validate configuration
            if (sendGrid == null) {
                throw new IllegalStateException("SendGrid is not initialized. API key may be missing or invalid.");
            }
            
            if (fromEmail == null || fromEmail.trim().isEmpty()) {
                throw new IllegalStateException("SendGrid from-email is not configured");
            }
            
            if (toEmail == null || toEmail.trim().isEmpty()) {
                throw new IllegalArgumentException("Recipient email cannot be null or empty");
            }
            
            Email from = new Email(fromEmail, fromName);
            Email to = new Email(toEmail.trim());
            String subject = "Reset Your Password";
            
            log.info("📧 Attempting to send password reset email from {} <{}> to {}", fromName, fromEmail, toEmail);

            // Create deep link with token
            String resetLink = resetPasswordUrl + "?token=" + resetToken;

            // HTML email template
            String htmlContent = buildPasswordResetEmailHtml(resetLink);

            Content content = new Content("text/html", htmlContent);
            Mail mail = new Mail(from, subject, to, content);

            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());

            Response response = sendGrid.api(request);

            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                log.info("Password reset email sent successfully to: {}", toEmail);
            } else {
                String errorBody = response.getBody() != null ? response.getBody() : "No error details";
                log.error("Failed to send password reset email. Status: {}, Body: {}", 
                        response.getStatusCode(), errorBody);
                throw new RuntimeException(
                    String.format("SendGrid API error: Status %d - %s", response.getStatusCode(), errorBody)
                );
            }
        } catch (IOException e) {
            log.error("IO error sending password reset email to: {}. Error: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send password reset email: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error sending password reset email to: {}. Error: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send password reset email: " + e.getMessage(), e);
        }
    }

    private String buildPasswordResetEmailHtml(String resetLink) {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Your Password</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
                    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. If you made this request, please click the link below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="%s" style="background-color: #FFD700; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666; font-size: 12px;">%s</p>
                    <p><strong>This link will expire in 15 minutes.</strong></p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                        <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email. 
                        Your password will remain unchanged. If you continue to receive these emails, please contact our support team.
                    </p>
                    <p style="color: #999; font-size: 12px; margin-top: 20px;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </body>
            </html>
            """.formatted(resetLink, resetLink);
    }
}

