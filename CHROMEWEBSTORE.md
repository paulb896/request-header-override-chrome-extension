# Chrome Web Store Listing — RequestFlow Pro

> Last Updated: 2026-06-19

## Store Listing

**Extension Name** [REQUIRED]
RequestFlow Pro — HTTP Request Header & Query Param Overrider

**Short Description** [REQUIRED]
Effortlessly override, add, or modify HTTP request headers, query parameters, and upstream responses using URL matching.

**Detailed Description** [REQUIRED]
RequestFlow Pro is a powerful and modern developer tool designed for API debugging, request modification, and response mocking. Built with a sleek, responsive, glassmorphic layout, it allows developers to quickly inspect, test, and troubleshoot outgoing web traffic.

Key Features:

- Inject, delete, or override custom HTTP request headers for matching URLs.
- Append, remove, or modify URL query parameters dynamically.
- Mock upstream API responses with custom HTTP status codes, headers, and JSON payloads.
- Clean, responsive dashboard layout with customizable Light/Dark modes.
- Real-time intercepted requests logs with a visual detail inspector.
- Secure, lightweight extension running on Manifest V3 with declarative rules.

How to use it:

1. Open the extension popup or click "Open Full Tab" for a spacious workspace view.
2. In the "Header Overrides" card, add a rule by specifying a matching URL wildcard/regex, header name, and value.
3. In the "Response Mocks" card, configure custom mock responses for specific API endpoints.
4. Outgoing fetch/XHR requests will automatically apply your overrides. Inspect results in the "Recent Network Requests" log panel.

Privacy and Security:
RequestFlow Pro runs entirely locally on your device. We collect zero analytics, capture no personal data, and never transmit your network rules or request logs off-device.

**Category** [REQUIRED]
Developer Tools

**Single Purpose** [REQUIRED]
Effortlessly override, add, or modify outgoing HTTP request headers, query parameters, and mock upstream responses using URL matching.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset                          | Dimensions  | Status   | Filename                           |
| ------------------------------ | ----------- | -------- | ---------------------------------- |
| Store Icon [REQUIRED]          | 128×128 PNG | ✅ Ready | `src/assets/img/main-icon-128.png` |
| Screenshot 1 [REQUIRED]        | 1280×800    | ✅ Ready | `store_screenshot_1.png`           |
| Screenshot 2 [RECOMMENDED]     | 1280×800    | ✅ Ready | `store_screenshot_2.png`           |
| Screenshot 3 [RECOMMENDED]     | 1280×800    | ✅ Ready | `store_screenshot_3.png`           |
| Screenshot 4                   | 1280×800    | ✅ Ready | `store_screenshot_4.png`           |
| Screenshot 5                   | 800x600     | ✅ Ready | `store_screenshot_5.png`           |
| Small Promo Tile [RECOMMENDED] | 440×280     | ✅ Ready | `small_promo_tile.png`             |
| Marquee Promo Tile             | 1400×560    | ✅ Ready | `marquee_promo_tile.png`           |

---

## Permissions Justification

| Permission              | Type             | Justification                                                                                                                                                                                                |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`               | permissions      | Required to save and load user-configured request headers, query parameters, and response override rules locally on the device.                                                                              |
| `declarativeNetRequest` | permissions      | Required to intercept and rewrite outgoing network requests (adding/overriding headers/query parameters) and mocking upstream API responses securely in the background, matching user-defined URL rule sets. |
| `webRequest`            | permissions      | Required for passive observation and logging of outgoing network requests (URLs, methods, request/response headers, status codes) to populate the developer's Recent Requests log view.                     |
| `<all_urls>`            | host_permissions | Required to allow the user to apply request header and query parameter overrides on any API domain or website they specify.                                                                                  |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification

- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
RequestFlow Pro operates entirely in your local browser sandbox. It stores network rules locally inside `chrome.storage.local` and logs intercepted headers to local state. It collects no personally identifiable information (PII), transmits no data over the internet, and shares nothing with third parties.

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name**
RequestFlow Pro Team

**Contact Email**
developer@requestflowpro.example.com

**Homepage URL**
https://github.com/paulb896/request-header-override-chrome-extension

---

## Version History

| Version | Date       | Changes                                                                                                                                                        | Status    |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 2.0.0   | 2026-06-19 | Overhauled popup to 3-column dashboard; added Options page full-tab support; added Response Mock rules; added Light/Dark mode themes; updated graphics assets. | Draft     |
| 1.0.1   | 2026-01-04 | Initial version supporting basic header overrides and popup UI.                                                                                                | Published |
