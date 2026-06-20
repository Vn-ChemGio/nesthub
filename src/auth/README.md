# NestHub Auth Module

All-in-one authentication module for NestJS, inspired by Better Auth. Supports multiple authentication mechanisms with enterprise-grade security.

## Features

- **Credentials**: Email/username + password login
- **OAuth**: Google, GitHub, Facebook, Apple, Microsoft, Discord, and custom providers
- **Two-Factor Auth (2FA)**: TOTP-based with backup codes
- **Anonymous**: Anonymous sessions convertible to permanent accounts
- **Magic Link**: Passwordless email login
- **OTP**: One-time password via email/phone
- **Passkey**: WebAuthn/FIDO2 passkey authentication
- **OneTap**: Google & Apple OneTap sign-in
- **SSO**: SAML & OpenID Connect support
- **Session Management**: Stateless JWT with refresh tokens, multi-device tracking, per-device logout (like Telegram)
- **Security**: Password hashing (bcrypt), rate limiting, token versioning, token blacklist via Redis/Valkey

## Installation

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt otplib
```

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'nesthub/auth';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ... }),
    AuthModule.forRoot({
      credentials: { enabled: true, allowRegistration: true },
      security: {
        jwtSecret: process.env.JWT_SECRET,
        passwordHashRounds: 12,
        maxSessions: { enabled: true, maxPerUser: 5 },
      },
      oauth: {
        google: {
          enabled: true,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github: {
          enabled: false,
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      },
      twoFactor: {
        enabled: true,
        issuer: 'MyApp',
      },
    }),
  ],
})
export class AppModule {}
```

## Configuration via .env

```env
# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=15m

# OAuth Providers
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
FACEBOOK_CLIENT_ID=xxx
FACEBOOK_CLIENT_SECRET=xxx
APPLE_CLIENT_ID=xxx
APPLE_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx

# App
APP_URL=http://localhost:3000
```

## Usage

### Register

```typescript
POST /auth/register
{ "email": "user@example.com", "password": "secure123", "name": "User", "deviceName": "iPhone 15" }
```

### Login

```typescript
POST /auth/login
{ "identifier": "user@example.com", "password": "secure123", "deviceName": "Chrome on Mac" }
```

### Response Structure

All endpoints return a consistent response format:

```typescript
// Successful login/register
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": false,
    "phone": null,
    "name": "User",
    "image": null,
    "roles": ["user"],
    "isAnonymous": false,
    "twoFactorEnabled": false,
    "twoFactorVerified": false
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}

// When 2FA is required
{
  "user": { ... },
  "requiresTwoFactor": true,
  "accessToken": ""
}
```

### Session Management (like Telegram)

List all active devices/sessions:

```typescript
GET /auth/sessions
Authorization: Bearer <accessToken>

// Response
[
  {
    "id": "uuid",
    "userId": "uuid",
    "jti": "hex-token-id",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0 ...",
    "deviceName": "Chrome on Mac",
    "expiresAt": "2026-07-20T00:00:00Z",
    "createdAt": "2026-06-20T00:00:00Z"
  }
]
```

Revoke a specific session (logout that device without affecting others):

```typescript
DELETE /auth/sessions/:id
Authorization: Bearer <accessToken>

// Response
{ "message": "Session revoked" }
```

Logout current session:

```typescript
POST /auth/logout
Authorization: Bearer <accessToken>

// Optional: pass jti to revoke a specific token
{ "jti": "hex-token-id" }
```

Logout all sessions (increments tokenVersion, invalidating all existing tokens):

```typescript
POST /auth/logout-all
Authorization: Bearer <accessToken>
```

### Magic Link

```typescript
POST /auth/magic-link/send
{ "email": "user@example.com" }

POST /auth/magic-link/verify
{ "token": "..." }
```

### OTP

```typescript
POST /auth/otp/send
{ "identifier": "user@example.com", "purpose": "login" }

POST /auth/otp/verify
{ "identifier": "user@example.com", "code": "123456", "purpose": "login" }
```

### 2FA

```typescript
GET /auth/2fa/setup          # Get TOTP secret + QR code URL
POST /auth/2fa/enable        # { "secret": "...", "code": "123456" }
POST /auth/2fa/verify        # { "code": "123456" }
POST /auth/2fa/disable
POST /auth/2fa/backup-codes  # Generate new backup codes
```

### Passkey (WebAuthn)

```typescript
POST /auth/passkeys/register/initiate
POST /auth/passkeys/register/complete
POST /auth/passkeys/authenticate/initiate
POST /auth/passkeys/authenticate/complete
GET  /auth/passkeys
DELETE /auth/passkeys/:id
```

### Anonymous

```typescript
POST /auth/anonymous
POST /auth/anonymous/convert
{ "email": "user@example.com", "password": "secure123", "name": "User" }
```

### OAuth

```typescript
GET  /auth/oauth/providers
POST /auth/oauth/:provider/callback
{ "code": "...", "redirectUri": "..." }
```

### OneTap

```typescript
POST /auth/onetap/google  { "idToken": "..." }
POST /auth/onetap/apple   { "idToken": "..." }
```

### SSO

```typescript
GET  /auth/sso/providers
POST /auth/sso/:provider/callback
{ "attributes": { "email": "...", "name": "..." } }
```

### Profile & Account

```typescript
GET    /auth/profile
POST   /auth/profile       { "name": "...", "image": "..." }
POST   /auth/change-password  { "currentPassword": "...", "newPassword": "..." }
DELETE /auth/account           # GDPR-compliant account deletion (anonymizes PII)
```

## API Reference

### AuthModule.forRoot(options)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `credentials` | `CredentialsConfig` | `{ enabled: true, allowRegistration: true }` | Email/phone + password login & registration |
| `oauth` | `ProviderConfig` | - | OAuth provider configs (each provider has `enabled` flag) |
| `sso` | `SSOProviderConfig[]` | - | SSO provider configs (each provider has `enabled` flag) |
| `twoFactor` | `TwoFactorConfig` | `{ enabled: true }` | 2FA configuration |
| `passkey` | `PasskeyConfig` | `{ enabled: false }` | WebAuthn config |
| `anonymous` | `AnonymousConfig` | `{ enabled: true }` | Anonymous auth config |
| `magicLink` | `MagicLinkConfig` | `{ enabled: false }` | Magic link config |
| `otp` | `OtpConfig` | `{ enabled: false }` | OTP config |
| `onelink` | `OnelinkConfig` | `{ enabled: false }` | Google & Apple OneTap sign-in |
| `security` | `SecurityConfig` | (see below) | Security settings |
| `email` | `EmailChannelConfig` | - | Email notification config |
| `override` | `OverrideConfig` | - | Override entities/services/controllers |

### Security Defaults

```typescript
{
  passwordHashRounds: 12,
  jwtExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  rateLimit: { enabled: true, maxAttempts: 5, windowMs: 900000 },
  requireEmailVerification: false,
  maxSessions: { enabled: false, maxPerUser: 5 },
}
```

### Override Custom Classes

You can extend and override any entity, service, or controller:

```typescript
import { AuthService, AuthController, User } from 'nesthub/auth';

class CustomUser extends User { /* extra columns */ }
class CustomAuthService extends AuthService { /* overridden methods */ }
class CustomAuthController extends AuthController { /* overridden endpoints */ }

AuthModule.forRoot({
  override: {
    entities: { user: CustomUser },
    services: { auth: CustomAuthService },
    controllers: { auth: CustomAuthController },
  },
})
```

## Guards & Decorators

```typescript
import { AuthGuard, RolesGuard } from 'nesthub/auth';
import { Public, CurrentUser, Roles } from 'nesthub/auth';

@UseGuards(AuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: AuthenticatedUser) {}

@Public()
@Get('public-route')
publicEndpoint() {}

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Get('admin')
adminOnly() {}
```

## Dependencies

Optional peer dependencies:
- `@nestjs/jwt` - JWT token handling
- `@nestjs/passport` + `passport` + `passport-jwt` - Passport strategies
- `bcrypt` - Password hashing
- `otplib` - TOTP for 2FA
- `@nestjs/cache-manager` or `nesthub/cache` (Redis/Valkey) - Token blacklist (recommended for production)
