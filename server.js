const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname)));

const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: smtpPort,
    secure: smtpSecure,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function clean(value, maxLength = 5000) {
    return String(value ?? '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
    return clean(value).replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function getRecipients() {
    return clean(process.env.MAIL_TO || 'purchase@rconnect.info,accounts@rconnect.info,support@rconnect.info')
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
}

app.get('/api/health', (req, res) => {
    res.json({ success: true, service: 'Rconnect email service' });
});

app.post('/api/send-email', async (req, res) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return res.status(500).json({
                success: false,
                message: 'SMTP credentials are not configured on the server.'
            });
        }

        const type = clean(req.body.type, 20);
        const name = clean(req.body.name, 150);
        const phone = clean(req.body.phone, 80);
        const email = clean(req.body.email, 200);

        if (!name || !phone || !email) {
            return res.status(400).json({ success: false, message: 'Please complete all required fields.' });
        }

        const isQuote = type === 'quote';
        const subject = isQuote
            ? `Rconnect Website - New Quote Request from ${name}`
            : `Rconnect Website - New Contact Message from ${name}`;

        let text;
        let html;

        if (isQuote) {
            const category = clean(req.body.category, 200);
            const budget = clean(req.body.budget, 200);
            const details = clean(req.body.details, 5000);
            const selectedProduct = clean(req.body.selectedProduct, 300);
            const selectedPrice = clean(req.body.selectedPrice, 100);

            text = [
                'NEW QUOTE REQUEST - Rconnect Website',
                '',
                `Name: ${name}`,
                `Phone: ${phone}`,
                `Email: ${email}`,
                `Category: ${category}`,
                `Budget: ${budget}`,
                `Selected Product: ${selectedProduct || 'None'}`,
                `Selected Price: ${selectedPrice || 'None'}`,
                `Details: ${details || 'Not provided'}`
            ].join('\n');

            html = `
                <h2>New Quote Request - Rconnect Website</h2>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Category:</strong> ${escapeHtml(category)}</p>
                <p><strong>Budget:</strong> ${escapeHtml(budget)}</p>
                <p><strong>Selected Product:</strong> ${escapeHtml(selectedProduct || 'None')} ${escapeHtml(selectedPrice)}</p>
                <p><strong>Details:</strong><br>${escapeHtml(details || 'Not provided').replace(/\n/g, '<br>')}</p>
            `;
        } else {
            const message = clean(req.body.message, 5000);

            if (!message) {
                return res.status(400).json({ success: false, message: 'Please enter your message.' });
            }

            text = [
                'NEW CONTACT MESSAGE - Rconnect Website',
                '',
                `Name: ${name}`,
                `Phone: ${phone}`,
                `Email: ${email}`,
                `Message: ${message}`
            ].join('\n');

            html = `
                <h2>New Contact Message - Rconnect Website</h2>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
            `;
        }

        const recipients = getRecipients();
        if (!recipients.length) {
            return res.status(500).json({ success: false, message: 'No email recipients are configured.' });
        }

        await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to: recipients,
            replyTo: email,
            subject,
            text,
            html
        });

        res.json({ success: true });
    } catch (error) {
        console.error('SMTP send error:', error);
        res.status(500).json({
            success: false,
            message: 'Email could not be sent. Check the Zoho SMTP settings and server log.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Rconnect website running at http://localhost:${PORT}`);
    console.log(`SMTP server: ${process.env.SMTP_HOST || 'smtp.zoho.com'}:${smtpPort}`);
});
