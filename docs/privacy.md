---
title: Privacy Policy
layout: default
---

# Privacy Policy

**Effective date: 21 May 2026**
**Last updated: 21 May 2026**

This Privacy Policy describes how BLENDRR Ai ("BLENDRR", "we", "us", or "our") collects, uses, and shares information about you when you use the BLENDRR Ai mobile application (the "App"). By using the App, you agree to the practices described here.

**TL;DR**: BLENDRR is built privacy-first. We don't ask for your name, email, or any login. Photos you upload are sent to AI providers for processing only and are not stored on our servers or used to train AI models. Your wishlist and history stay on your device.

---

## 1. Who we are

BLENDRR Ai is an iOS application that lets you virtually try on cosmetics, build skincare and haircare routines, find fragrances, and check the ingredients of beauty products using AI.

If you have questions about this policy or how we handle your data, contact us at:

**blendrr.ai.app@gmail.com**

---

## 2. Information we collect

We collect the minimum amount of information needed to run the App.

### 2.1 Anonymous device identifier

When you first open BLENDRR Ai, we generate a random anonymous identifier (a UUID — for example, `f47ac10b-58cc-4372-a567-0e02b2c3d479`) and store it in your device's secure keychain. This identifier is not linked to your name, email, phone number, or Apple ID. We use it to:

- Keep track of your credit balance across sessions
- Issue you a unique referral code
- Persist your account across app reinstalls (the keychain entry survives uninstalling the App)

You can reset this identifier by tapping **Menu → Settings → Clear all app data**, which generates a new identifier the next time you open the App.

### 2.2 Photos you provide

When you use the try-on, skincare, haircare, acne, or ingredient scanner features, you choose photos (selfies, product photos, or screenshots) from your device. These photos:

- Are uploaded to AI providers for processing (see "Third-party services" below)
- Are **not stored on BLENDRR's servers**
- Are **not used to train AI models** (our AI providers have data-sharing settings disabled by default for paid API usage)
- May be temporarily cached on your device for the duration of the try-on or analysis

The generated try-on result image is stored locally on your device (in app history) until you delete it.

### 2.3 Quiz answers

When you take the skincare, haircare, acne, or fragrance quizzes, your selections (skin type, concerns, scent preferences, etc.) are:

- Sent to our AI provider (Google Gemini) for analysis
- Stored locally on your device so you can revisit your routine
- **Not stored on BLENDRR's servers**

### 2.4 Wishlist, try-on history, and analyses

Items you save to your wishlist, generated try-ons, and quiz results are stored **only on your device** using the iOS standard storage. They are not transmitted to BLENDRR's servers.

### 2.5 Purchase information

When you buy a subscription or credit pack:

- Apple processes the payment through your Apple ID — we never see your payment details
- RevenueCat (our subscription management provider) records that a purchase occurred and the product purchased
- We receive a notification that your credit balance should be updated

We do not see, store, or process your credit card, debit card, Apple Pay, or other payment information.

### 2.6 Diagnostic information

The App may use Apple's standard crash reporting (visible in iPhone Settings → Privacy → Analytics). We do not run third-party analytics, advertising SDKs, or tracking pixels.

### 2.7 What we do NOT collect

We do not collect, ask for, or have access to:

- Your name
- Your email address
- Your phone number
- Your physical address or precise location
- Your contacts
- Your browsing history outside the App
- Your social media accounts
- Biometric identifiers (face recognition data is not extracted or stored — the AI processes your selfie as an image, the same way any photo app would)

---

## 3. How we use your information

We use the limited information we collect to:

- Provide try-on, quiz, and analysis features
- Process purchases and apply credits to your account
- Validate referral codes
- Prevent abuse (e.g. detecting an account exceeding usage limits)
- Improve the App by understanding which features are used (via aggregate counts only — no personal data)

We do not use your information for advertising. We do not sell your information to third parties. We do not share your information with advertisers, data brokers, or marketers.

---

## 4. Third-party services

We share limited information with the following service providers to deliver the App's features:

### 4.1 OpenAI (image generation)

When you start a try-on, your selfie and the product photo(s) are sent to OpenAI's API for image editing. Under OpenAI's API data usage policy, inputs and outputs from API customers are **not used to train OpenAI's models**. OpenAI retains API request data for up to 30 days for abuse monitoring, then deletes it. See OpenAI's policy: https://openai.com/policies/api-data-usage-policies

### 4.2 Google (Gemini AI)

We use Google's Gemini AI for: extracting shade information from product photos, analyzing skincare/haircare/acne selfies, generating routine recommendations, finding products via web search, discovering fragrances, and analyzing ingredient lists. Photos and quiz answers are sent to Google's API.

Under Google's paid Gemini API terms, your inputs are **not used to train Google's models** (this is the default; we have not opted in to data sharing). See Google's policy: https://ai.google.dev/gemini-api/terms

### 4.3 Supabase (backend hosting)

Our anonymous user records, credit balances, referral codes, and temporary try-on job queue rows are hosted on Supabase. The only personal-ish data here is your anonymous UUID and the photos uploaded during an active try-on (which are deleted within 24 hours of completion). Supabase is GDPR-compliant. See https://supabase.com/privacy

### 4.4 Apple (App Store and StoreKit)

All subscriptions and credit purchases are processed by Apple through your Apple ID. Apple handles your payment information directly. See Apple's privacy policy: https://www.apple.com/legal/privacy

### 4.5 RevenueCat (subscription management)

RevenueCat receives anonymized purchase events from Apple and tells us when your subscription status changes. They store: your anonymous BLENDRR UUID, the products you've purchased, and the timing of those purchases. They do not receive your payment information, name, or email. See https://www.revenuecat.com/privacy

---

## 5. Data retention

| Data | Retained | Where |
|---|---|---|
| Anonymous UUID | Until you uninstall and clear keychain, or tap Clear all data | iOS keychain on your device + our Supabase user record |
| Credit balance | Until you delete your account (Clear all data) | Supabase |
| Wishlist + history | Until you delete it from the App | Your device only |
| Photos uploaded for try-on | Up to 24 hours after the try-on completes | Temporarily in our try-on job queue |
| Generated try-on images | Until you delete them | Your device only |
| Referral records | Permanent (anonymous code mapping) | Supabase |
| Purchase records | Per Apple's retention policy | Apple |

When you tap **Clear all app data** in Settings, all local data is deleted. To delete your server-side record (anonymous UUID, credit balance, referrals), email us at blendrr.ai.app@gmail.com and we will erase it within 30 days.

---

## 6. Your privacy rights

Depending on where you live, you may have the following rights regarding your personal data:

- **Access** — request a copy of data we hold about you
- **Correction** — ask us to correct inaccurate data
- **Deletion** — ask us to delete your data
- **Portability** — receive your data in a structured, machine-readable format
- **Object** — object to certain types of processing
- **Restrict** — limit how we process your data
- **Withdraw consent** — where processing is based on consent

To exercise any of these rights, email us at **blendrr.ai.app@gmail.com**. Because BLENDRR does not collect identifying information by default, you may need to provide your anonymous UUID (shown in the App's Settings) to help us locate your record.

### UK and EU residents (UK GDPR / GDPR)

If you are in the UK or EU, the lawful basis for our processing is:

- **Performance of a contract** — to provide the App's features when you use them
- **Legitimate interests** — to prevent abuse, improve the service, and operate our business
- **Consent** — where you explicitly grant permissions (e.g. camera, photo library, notifications)

You have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at https://ico.org.uk or your local data protection authority.

### California residents (CCPA)

If you are a California resident, you have the right to know what categories of personal information we collect, the right to delete that information, and the right to non-discrimination for exercising your rights. We do not sell personal information.

---

## 7. International data transfers

BLENDRR is operated from the United Kingdom. Our AI providers (OpenAI, Google) primarily process data in the United States. Supabase hosts our data on servers in the EU. When you use the App, your data may be transferred outside your country of residence. We rely on standard contractual clauses and equivalent safeguards required by UK GDPR / GDPR for these transfers.

---

## 8. Security

We use industry-standard security measures to protect your data:

- Encrypted transport (HTTPS / TLS) for all API requests
- Anonymous identifiers stored in iOS keychain (secure enclave on supported devices)
- Server-side row-level security on Supabase ensures one user's data cannot be accessed by another
- No payment information ever passes through BLENDRR's servers (Apple handles all payments)

No system is 100% secure. If we ever become aware of a data breach affecting your information, we will notify affected users in accordance with applicable law.

---

## 9. Children's privacy

The App is not intended for children under 13 (or under 16 in some EU countries). We do not knowingly collect information from anyone under these ages. If you believe a child has used the App, contact us and we will delete their data.

---

## 10. Permissions we ask for

The App requests the following iOS permissions when needed:

- **Camera** — to take selfies or product photos in the App
- **Photo library** — to pick existing photos for selfies or products
- **Notifications** — to remind you about your routine and tell you when a try-on finishes if you've swiped out of the App

You can grant or revoke any of these in iPhone Settings → BLENDRR Ai → at any time. The App continues to work with permissions revoked — you just won't be able to use the corresponding features.

---

## 11. Changes to this policy

We may update this Privacy Policy from time to time. If we make material changes, we'll update the "Last updated" date at the top and surface a notice in the App. Continued use of the App after a change means you accept the updated policy.

---

## 12. Contact

For questions, complaints, or data requests:

**Email**: blendrr.ai.app@gmail.com

We aim to respond within 7 working days, and resolve data requests within 30 days as required by GDPR / UK GDPR.
