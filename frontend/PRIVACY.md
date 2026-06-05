# Privacy Policy

> **TODO (legal):** Replace `PDFMindAI`, `legal@pdfmindai.com`, jurisdiction, and effective date with your actual entity details. Have a lawyer review before launch.

**Effective Date:** 01 January 2026
**Operated by:** PDFMindAI ("we", "us", "our")

This Privacy Policy explains how PDFMindAI ("the Service") collects, uses, shares, and protects your information. By using the Service, you agree to the practices described here.

---

## 1. Information We Collect

### 1.1 Information you provide
- **Account:** Username, password (stored as a bcrypt hash, never in plain text), optional admin flag.
- **PDFs you upload:** Stored in our database along with metadata (filename, page count, last-read page).
- **Annotations, highlights, notes, sticky notes, drawings:** Stored to power the annotation features and collaborative sessions.
- **Word lookups, bookmarks, flashcards, reading history:** Stored to provide personalized learning features and reading analytics.
- **Chat messages and comments in collaborative sessions:** Stored to deliver real-time messaging.
- **Support communications:** If you contact us, we retain the messages.

### 1.2 Information collected automatically
- **Usage data:** Pages read, time spent reading, words looked up, sessions joined — to compute reading statistics, streaks, and daily goals.
- **Device and browser:** User-agent, screen size, language preference.
- **Theme preferences:** Selected theme (light/dark) and accent color, stored in your browser's local storage.
- **Authentication token:** JSON Web Token (JWT) stored in your browser's local storage to keep you signed in.
- **Cookies:** The Service does not use tracking cookies. We only use the JWT token (local storage) and functional local storage entries.

### 1.3 Information sent to third-party AI providers
When you click a word to get its meaning or use another AI feature, the following data is sent to **Google Gemini** and/or **Groq**:
- The selected word
- The surrounding sentence (context)
- Page number
- Your preferred translation language and accent

This data is sent only when you trigger an AI lookup. It is governed by the privacy policies of those providers (linked below). Do not use the Service on documents containing information you do not wish to share with these providers.

## 2. How We Use Your Information
- To provide, maintain, and improve the Service.
- To authenticate you and keep your account secure.
- To deliver AI-generated explanations, translations, summaries, and questions.
- To synchronize your bookmarks, flashcards, annotations, and reading progress across devices.
- To enable real-time collaborative reading sessions you join.
- To generate anonymized usage analytics (e.g., total active users, popular features).
- To detect and prevent abuse or violations of our Terms.
- To respond to your support requests.

## 3. Third-Party Services
We share data with the following third parties strictly to operate the Service:

| Provider | Purpose | Data shared | Privacy policy |
|----------|---------|-------------|----------------|
| **Google Gemini** (`@google/generative-ai`) | AI word explanations, sentence simplification, summaries, question generation | Selected word, surrounding sentence, page number, target language | https://policies.google.com/privacy |
| **Groq** (`groq-sdk`) | Primary AI word explanations (fallback to Gemini) | Same as above | https://groq.com/privacy-policy/ |
| **MongoDB Atlas** | Database hosting for accounts, PDFs, annotations, bookmarks, flashcards, chat, sessions | All persistent user data | https://www.mongodb.com/legal/privacy-policy |
| **Tesseract.js** | OCR for image-only PDFs (runs entirely in your browser) | None — runs client-side | n/a |
| **Web Speech API** | Text-to-speech (browser-native) | None — runs client-side | n/a |

We do not sell your data. We do not share your data with advertisers.

## 4. Cookies and Local Storage
The Service uses browser local storage for:
- `auth-token` — your JWT
- `pdf-reader-ai-translation-language` — your translation preference
- `pdf-reader-ai-accent` — your TTS accent
- `pdf-reader-ai-theme`, `pdf-reader-ai-theme-accent` — UI theme
- `pdfDataUrl` — your currently open PDF (kept locally, cleared on logout)

You can clear local storage from your browser settings at any time. Doing so will sign you out.

## 5. Data Storage and Security
- Data is stored in MongoDB Atlas (encrypted at rest by the cloud provider).
- Passwords are hashed with bcrypt (10 rounds) — we never store plain-text passwords.
- Authentication uses signed JWTs (HS256) with a 7-day expiry.
- The Service is served over HTTPS in production.
- We follow industry best practices to protect your data, but no system is 100% secure. We cannot guarantee absolute security.

## 6. Data Retention
- **Account data:** Retained while your account is active. Deleted within 30 days of account deletion, except where retention is required by law.
- **Uploaded PDFs and annotations:** Retained while your account is active, or until you delete them.
- **Reading history and analytics:** Retained for the lifetime of your account to compute streaks and goals.
- **Chat messages in collaborative sessions:** Retained while the session exists.
- **AI lookup history:** Retained for the lifetime of your account.
- **Backups:** Database snapshots may persist for up to 30 days after deletion.

## 7. Your Rights
You have the right to:
- **Access** the personal data we hold about you.
- **Correct** inaccurate data.
- **Delete** your account and associated data.
- **Export** your data (bookmarks, flashcards, annotations) in a portable format.
- **Opt out** of AI features by not clicking words; no AI calls are made until you trigger one.

To exercise these rights, go to your Profile page or email privacy@pdfmindai.com. We will respond within 30 days.

## 8. Children's Privacy
The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, contact privacy@pdfmindai.com and we will delete it.

## 9. International Data Transfers
PDFMindAI uses providers that may process data in countries other than your own (e.g., Google and Groq in the US, MongoDB Atlas in various regions). By using the Service, you consent to the transfer of your data to these jurisdictions.

## 10. Do Not Track
The Service does not track users across third-party websites and does not respond to Do Not Track signals.

## 11. Changes to this Policy
We may update this Privacy Policy. If we make material changes, we will notify you by email or in-app notice at least 14 days before the changes take effect. The "Effective Date" at the top of this page reflects the latest revision.

## 12. Contact
If you have questions or complaints about this Privacy Policy or our data practices, contact us at:
**Email:** privacy@pdfmindai.com

If you are in the European Economic Area, UK, or California and believe we have not addressed your concern, you have the right to lodge a complaint with your local data-protection authority.

---

By using PDFMindAI, you acknowledge that you have read and understood this Privacy Policy.
