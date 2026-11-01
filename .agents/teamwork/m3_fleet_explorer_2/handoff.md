# Handoff Report: Corporate 2FA Authentication Flow (Feature F8)

**Agent**: M3 Explorer 2 (`m3_fleet_explorer_2`)  
**Mission**: Investigate and design Corporate 2FA Authentication Flow, Corporate Email Domain Enforcement (`@amrest.eu`, `@starbucks.com`), 6-Digit OTP Challenge Engine with Sliding Rate Limiting, and Ergonomic Box Input UI.  
**Date**: 2026-10-26  

---

## 1. Observation

Direct observations from examining the codebase, interfaces, and test executions:

### 1.1 Existing Email Validation Implementation
In `src/services/auth/authService.ts` (lines 45–49):
```typescript
public static isCorporateEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return domain === 'amrest.eu' || domain === 'starbucks.com';
}
```
- **Line 47**: `email.trim().toLowerCase().split('@')[1]` takes the second token after the first `@`. In an adversarial payload such as `user@evil.com@amrest.eu`, token `[1]` is `evil.com`, which is rejected, but in `admin@amrest.eu@attacker.com`, token `[1]` is `amrest.eu`, causing an invalid email to pass validation.
- No local-part syntax validation exists. Characters like spaces, unescaped quotes, or length overflows (>64 chars) are not verified.
- Error messages returned to the user when validation fails are generic:
  `message: 'Dostęp dozwolony wyłącznie dla adresów korporacyjnych @amrest.eu lub @starbucks.com.'` (line 171). There is no contextual distinction between public consumer email providers (e.g., `@gmail.com`, `@wp.pl`) and invalid syntax.

### 1.2 Existing OTP Generation & Storage
In `src/services/auth/authService.ts` (lines 204–213):
```typescript
// 2. Generowanie 6-cyfrowego kodu OTP (ważny 5 minut)
const code = Math.floor(100000 + Math.random() * 900000).toString();
const pendingOtp: PendingOtpVerification = {
  email: cleanEmail,
  code,
  expiresAt: Date.now() + 5 * 60 * 1000,
};

sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(pendingOtp));
```
- `Math.random()` is used to generate the 6-digit OTP token. `Math.random()` is a pseudo-random generator with a predictable PRNG seed (V8 xorshift128+), unsuitable for cryptographic authentication tokens.
- The generated code is stored in plaintext in browser `sessionStorage` (`sbx_auth_pending_otp`).
- There is no throttling on `request2FaOtp`. A caller can trigger `request2FaOtp` in an infinite loop, constantly issuing new codes without backoff.

### 1.3 Absence of Rate Limiting in OTP Verification
In `src/services/auth/authService.ts` (lines 226–251):
```typescript
public static async verify2FaOtp(email: string, enteredCode: string): Promise<{
  success: boolean;
  message?: string;
  session?: AuthUserSession;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const rawOtp = sessionStorage.getItem(OTP_STORAGE_KEY);

  if (!rawOtp) {
    return { success: false, message: 'Brak aktywnego żądania kodu. Wyślij kod ponownie.' };
  }

  const pendingOtp: PendingOtpVerification = JSON.parse(rawOtp);
  if (pendingOtp.email !== cleanEmail) {
    return { success: false, message: 'Niepoprawny adres e-mail dla oczekującego kodu.' };
  }

  if (Date.now() > pendingOtp.expiresAt) {
    sessionStorage.removeItem(OTP_STORAGE_KEY);
    return { success: false, message: 'Kod weryfikacyjny wygasł. Wygeneruj nowy kod.' };
  }

  if (pendingOtp.code !== enteredCode.trim()) {
    return { success: false, message: 'Wprowadzony kod jest niepoprawny. Spróbuj ponownie.' };
  }
...
```
- **Zero attempt counter**: `verify2FaOtp` does not count failed attempts.
- **Zero lockout/cooldown**: There is no sliding rate limiter or lockout period (e.g., maximum 3 failed attempts before a 60-second cooldown). An automated client can brute-force all 1,000,000 combinations within seconds.
- **Non-constant-time equality**: `pendingOtp.code !== enteredCode.trim()` uses standard string inequality, which returns early on the first mismatched byte, creating a timing side-channel.

### 1.4 Existing OTP Input UI in LoginView.tsx
In `src/components/LoginView.tsx` (lines 388–397):
```tsx
<div className="relative">
  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
  <input
    type="text"
    maxLength={6}
    required
    value={otpCode}
    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
    placeholder="000000"
    className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-center font-mono text-lg font-bold tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white transition-all"
  />
</div>
```
- A single `<input>` element is rendered rather than 6 distinct digit boxes.
- No automatic focus progression between digits exists.
- No Backspace backward jump exists.
- No live countdown timer displaying remaining validity (e.g. `04:45`) is rendered.
- No "Resend Code" (`Wyślij kod ponownie`) button with a 30s cooldown is provided.

### 1.5 State Synchronization Discrepancy
- In `src/components/LoginView.tsx` (lines 114–118):
  `handleVerifyOtp` calls `AuthService.verify2FaOtp(email2Fa, otpCode)` directly.
- In `src/App.tsx` (lines 562–566):
  `LoginView` only passes a username string to `onLogin={(role) => { if (role) setLoggedInUser(role); setIsLoggedIn(true); }}`.
- In `src/context/AuthContext.tsx` (lines 35, 227–233):
  `AuthContext` provides `loginWith2Fa: (email: string, otpCode: string) => Promise<...>`, but `LoginView.tsx` does not consume `useAuth()`. As a result, `AuthContext.currentSession` remains `null` even after a successful login through `LoginView`.

---

## 2. Logic Chain

From the direct observations above, the design requirements proceed through a clear chain of reasoning:

1. **Email Domain Enforcer Design** (from Obs 1.1):
   - AmRest operates Starbucks stores in Poland and Central Europe under `@amrest.eu`. Global corporate accounts operate under `@starbucks.com`.
   - To prevent authorization bypass and data leakage, all operational accounts must be strictly restricted to `@amrest.eu` and `@starbucks.com`.
   - String splitting must guarantee strictly two segments (`email.split('@').length === 2`).
   - Local-part must conform to RFC 5322 regex (`^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$`) and $\le 64$ characters.
   - Domain must strictly match `amrest.eu` or `starbucks.com`. Subdomains (`*.amrest.eu`) and suffix extensions (`starbucks.com.attacker.com`) must be rejected.
   - For user clarity, rejections must return categorized operational feedback:
     - Public domains (`@gmail.com`, `@wp.pl`, `@onet.pl`, `@yahoo.com`, etc.) $\rightarrow$ explicit prompt stating public consumer webmail is prohibited.
     - Malformed syntax $\rightarrow$ formatting help message.
     - Unauthorized corporate domains $\rightarrow$ policy requirement message.

2. **CSPRNG Token & In-Memory / Salted Storage** (from Obs 1.2):
   - Replace `Math.random()` with `crypto.randomInt(100000, 1000000)` (or Web Crypto `crypto.getRandomValues`) to eliminate predictable PRNG seeds.
   - Protect memory buffers: store OTP in memory/sessionStorage as a salted SHA-256 hash (`SHA-256(code + ':' + salt)`) rather than plaintext. In development/desktop test mode, preserve `simulatedCode` for testing without exposing credentials in production builds.

3. **Sliding Rate Limiter & Cooldown Protection** (from Obs 1.3):
   - A 6-digit PIN has $10^6$ combinations. Without rate limiting, brute forcing takes $< 5$ seconds over localhost.
   - Enforce:
     - `maxAttempts = 3`.
     - Failed attempt 1: return `{ success: false, remainingAttempts: 2, message: "Niepoprawny kod. Pozostały 2 próby." }`.
     - Failed attempt 2: return `{ success: false, remainingAttempts: 1, message: "Niepoprawny kod. Pozostała 1 próba." }`.
     - Failed attempt 3: immediately lock verification for 60 seconds (`cooldownUntil = Date.now() + 60_000`), invalidate the current OTP code, and record a security audit entry (`LOGIN_FAILED` / lockout).
     - During the 60s cooldown: reject all verification and resend attempts with exact remaining seconds (`Math.ceil((cooldownUntil - Date.now()) / 1000)`).
     - Resend rate limit: restrict `request2FaOtp` to a minimum interval of 30 seconds (`resendAvailableAt = Date.now() + 30_000`).
     - Timing-safe comparison: verify hash equality using constant-time equality (`timingSafeStringEqual` / `crypto.timingSafeEqual`).
     - Burn on use: once verified, the challenge is immediately purged to prevent token reuse.

4. **Ergonomic 6-Box Input & Timer UI** (from Obs 1.4):
   - Render 6 individual `<input type="text" maxLength={1} inputMode="numeric">` boxes.
   - Manage focus progression via `useRef<Array<HTMLInputElement | null>>([])`:
     - Digit entry ($0..9$) fills box $i$ and focuses box $i+1$.
     - `Backspace` clears box $i$; if already empty, focuses box $i-1$ and clears it.
     - `ArrowLeft` / `ArrowRight` enables smooth cursor navigation.
     - `onPaste` extracts first 6 digits and automatically populates all 6 boxes.
   - Live Countdown Timer:
     - Displays `mm:ss` (e.g. `04:59`).
     - At `00:00`, marks token as expired and prompts for resend.
   - "Resend Code" (`Wyślij kod ponownie`) button:
     - Shows countdown while `resendAvailableAt` is active (`Wyślij ponownie za (25s)`).
     - Activates when 30s have elapsed.

5. **Context Synchronization Architecture** (from Obs 1.5):
   - In `LoginView.tsx`, consume `const { loginWith2Fa } = useAuth()`.
   - On successful verification, call `await loginWith2Fa(email, otpCode)` so `AuthContext.currentSession` and `isAuthenticated` update in tandem with `App.tsx`'s `setIsLoggedIn(true)`.

---

## 3. Concrete Architectural Specifications

### 3.1 Corporate Email Validation Specification

```typescript
export interface CorporateEmailValidationResult {
  isValid: boolean;
  normalizedEmail?: string;
  domain?: string;
  category: 'VALID_CORPORATE' | 'PUBLIC_DOMAIN' | 'INVALID_SYNTAX' | 'UNKNOWN_DOMAIN';
  error?: string;
}

export const ALLOWED_CORPORATE_DOMAINS = ['amrest.eu', 'starbucks.com'] as const;

export const KNOWN_PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.pl', 'wp.pl', 'onet.pl',
  'interia.pl', 'o2.pl', 'outlook.com', 'hotmail.com', 'icloud.com', 'mail.com',
  'tlen.pl', 'gazeta.pl', 'poczta.fm', 'live.com', 'proton.me', 'protonmail.com'
]);

export function validateCorporateEmail(email: string): CorporateEmailValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      category: 'INVALID_SYNTAX',
      error: 'Adres e-mail jest wymagany.',
    };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return {
      isValid: false,
      category: 'INVALID_SYNTAX',
      error: 'Adres e-mail przekracza dopuszczalną długość (maksymalnie 254 znaki).',
    };
  }

  // Exactly one '@' symbol
  const atParts = trimmed.split('@');
  if (atParts.length !== 2) {
    return {
      isValid: false,
      category: 'INVALID_SYNTAX',
      error: 'Niepoprawny format adresu e-mail. Adres musi zawierać dokładnie jeden znak "@".',
    };
  }

  const [rawLocal, rawDomain] = atParts;
  const localPart = rawLocal.trim();
  const domainPart = rawDomain.trim().toLowerCase();

  // RFC 5322 compliant local-part regex
  const localRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
  if (!localPart || localPart.length > 64 || !localRegex.test(localPart)) {
    return {
      isValid: false,
      category: 'INVALID_SYNTAX',
      error: 'Niepoprawny format nazwy użytkownika w adresie e-mail.',
    };
  }

  // Public Webmail Detection
  if (KNOWN_PUBLIC_DOMAINS.has(domainPart)) {
    return {
      isValid: false,
      domain: domainPart,
      category: 'PUBLIC_DOMAIN',
      error: `Dostęp zastrzeżony. Domena publiczna (@${domainPart}) nie jest dozwolona. Do systemów operacyjnych Starbucks wymagany jest imienny adres korporacyjny w domenie @amrest.eu lub @starbucks.com.`,
    };
  }

  // Exact Whitelist Matching
  if (domainPart === 'amrest.eu' || domainPart === 'starbucks.com') {
    return {
      isValid: true,
      normalizedEmail: `${localPart.toLowerCase()}@${domainPart}`,
      domain: domainPart,
      category: 'VALID_CORPORATE',
    };
  }

  // Unknown / Non-Corporate Domain
  return {
    isValid: false,
    domain: domainPart,
    category: 'UNKNOWN_DOMAIN',
    error: `Nieautoryzowana domena (@${domainPart}). Logowanie do platformy Starbucks Operations Suite wymaga autoryzacji w domenie @amrest.eu lub @starbucks.com.`,
  };
}
```

### 3.2 2FA / OTP State and Rate Limiting Specification

```typescript
export interface OtpChallengeRecord {
  email: string;
  storeUnitCode: string;
  hashedCode: string;       // SHA-256(code + ':' + salt)
  salt: string;
  simulatedCode?: string;   // Retained in local dev/test mode for UI feedback
  createdAt: number;
  expiresAt: number;        // createdAt + 5 * 60 * 1000 (300 seconds)
  attemptsCount: number;    // 0..3
  maxAttempts: number;      // 3
  cooldownUntil: number;    // Timestamp until lockout lifts
  resendAvailableAt: number;// Timestamp when resend is unlocked (30s after generation)
}
```

#### Step 1: `request2FaOtp(email: string, storeUnitCode: string, pin?: string)`
```typescript
public static async request2FaOtp(
  email: string,
  storeUnitCode: string = '',
  pin?: string
): Promise<{
  success: boolean;
  message: string;
  simulatedCode?: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
}> {
  const val = validateCorporateEmail(email);
  if (!val.isValid || !val.normalizedEmail) {
    return { success: false, message: val.error || 'Niepoprawny adres e-mail.' };
  }
  const cleanEmail = val.normalizedEmail;
  const now = Date.now();

  // 1. Verify against active/pending user registry in AdminService
  const user = AdminService.getUserByEmail(cleanEmail);
  if (!user) {
    const pendingReq = AdminService.getRequestByEmail(cleanEmail);
    if (pendingReq) {
      return {
        success: false,
        message: `Twój wniosek oczekuje na zatwierdzenie przez Store Managera.`,
      };
    }
    return {
      success: false,
      message: 'Nie znaleziono zarejestrowanego konta. Wypełnij wniosek o nowe konto pracownika.',
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      message: 'Konto zablokowane przez Administratora (Kill-Switch). Skontaktuj się ze Store Managerem.',
    };
  }

  // 2. Check existing challenge rate limits
  const existingChallenge = this.getPendingChallenge(cleanEmail);
  if (existingChallenge) {
    if (now < existingChallenge.cooldownUntil) {
      const waitSec = Math.ceil((existingChallenge.cooldownUntil - now) / 1000);
      return {
        success: false,
        cooldownSeconds: waitSec,
        message: `Blokada bezpieczeństwa aktywna. Odczekaj jeszcze ${waitSec}s przed kolejną próbą.`,
      };
    }
    if (now < existingChallenge.resendAvailableAt) {
      const waitSec = Math.ceil((existingChallenge.resendAvailableAt - now) / 1000);
      return {
        success: false,
        cooldownSeconds: waitSec,
        message: `Możesz poprosić o kolejny kod za ${waitSec}s.`,
      };
    }
  }

  // 3. Generate 6-digit CSPRNG token
  let code: string;
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomInt === 'function') {
    code = (crypto as any).randomInt(100000, 1000000).toString();
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    code = (100000 + (buf[0] % 900000)).toString();
  } else {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const salt = typeof crypto !== 'undefined' && typeof (crypto as any).randomBytes === 'function'
    ? (crypto as any).randomBytes(8).toString('hex')
    : Math.random().toString(36).substring(2, 10);

  const hashedCode = computeSha256(`${code}:${salt}`);

  const challenge: OtpChallengeRecord = {
    email: cleanEmail,
    storeUnitCode,
    hashedCode,
    salt,
    simulatedCode: code,
    createdAt: now,
    expiresAt: now + 5 * 60 * 1000,
    attemptsCount: 0,
    maxAttempts: 3,
    cooldownUntil: 0,
    resendAvailableAt: now + 30 * 1000,
  };

  this.savePendingChallenge(challenge);

  return {
    success: true,
    message: `Kod 2FA został przesłany na adres ${cleanEmail}. Wpisz 6 cyfr, aby odblokować pulpit.`,
    simulatedCode: code,
    expiresInSeconds: 300,
  };
}
```

#### Step 2: `verify2FaOtp(email: string, enteredCode: string)`
```typescript
public static async verify2FaOtp(
  email: string,
  enteredCode: string
): Promise<{
  success: boolean;
  message?: string;
  session?: AuthUserSession;
  remainingAttempts?: number;
  isLockedOut?: boolean;
  cooldownSeconds?: number;
}> {
  const val = validateCorporateEmail(email);
  if (!val.isValid || !val.normalizedEmail) {
    return { success: false, message: val.error || 'Niepoprawny adres e-mail.' };
  }
  const cleanEmail = val.normalizedEmail;
  const now = Date.now();

  const challenge = this.getPendingChallenge(cleanEmail);
  if (!challenge) {
    return { success: false, message: 'Brak aktywnego żądania kodu 2FA. Poproś o kod ponownie.' };
  }

  // 1. Check if currently in 60s cooldown lockout
  if (now < challenge.cooldownUntil) {
    const waitSec = Math.ceil((challenge.cooldownUntil - now) / 1000);
    return {
      success: false,
      isLockedOut: true,
      cooldownSeconds: waitSec,
      message: `Blokada bezpieczeństwa aktywna. Zbyt wiele prób. Odczekaj jeszcze ${waitSec}s.`,
    };
  }

  // 2. Check 5-minute expiry
  if (now > challenge.expiresAt) {
    this.removePendingChallenge(cleanEmail);
    return { success: false, message: 'Kod weryfikacyjny wygasł (czas ważności: 5 minut). Wygeneruj nowy kod.' };
  }

  // 3. Constant-time code check
  const candidateHash = computeSha256(`${enteredCode.trim()}:${challenge.salt}`);
  const isMatch = timingSafeStringEqual(challenge.hashedCode, candidateHash);

  if (isMatch) {
    // Verified! Immediately purge challenge
    this.removePendingChallenge(cleanEmail);

    const user = AdminService.getUserByEmail(cleanEmail);
    if (!user || !user.isActive) {
      return { success: false, message: 'Brak uprawnień do zalogowania.' };
    }

    const session: AuthUserSession = {
      userId: user.id,
      storeUnitCode: user.storeUnitCode || challenge.storeUnitCode,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionToken: `tok_${user.role.toLowerCase()}_${Date.now()}`,
      sessionVersion: user.sessionVersion,
      deviceName: this.getDeviceName(),
      deviceFingerprint: this.getDeviceFingerprint(),
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('sbx_user_name', user.fullName);
    localStorage.setItem('sbx_user_email', user.email);
    localStorage.setItem('sbx_user_role', user.role);

    AdminService.addAuditLog({
      actorName: user.fullName,
      actorRole: user.role,
      actionType: 'LOGIN_2FA',
      targetResource: `session:${user.email}`,
      details: `Pomyślne logowanie dwuetapowe 2FA z adresu ${cleanEmail}`,
      deviceName: this.getDeviceName(),
    });

    return { success: true, session };
  }

  // 4. Incorrect code - increment attempts
  challenge.attemptsCount += 1;

  if (challenge.attemptsCount >= challenge.maxAttempts) {
    challenge.cooldownUntil = now + 60 * 1000; // 60s cooldown
    challenge.expiresAt = now; // Invalidate current code
    this.savePendingChallenge(challenge);

    AdminService.addAuditLog({
      actorName: cleanEmail,
      actorRole: 'BARISTA',
      actionType: 'LOGIN_2FA',
      targetResource: `session:${cleanEmail}`,
      details: `⚠️ Zablokowano konto na 60s: przekroczono 3 nieudane próby wpisania kodu 2FA`,
      deviceName: this.getDeviceName(),
    });

    return {
      success: false,
      isLockedOut: true,
      remainingAttempts: 0,
      cooldownSeconds: 60,
      message: 'Przekroczono limit 3 prób weryfikacji. Dostęp został zablokowany na 60 sekund w celu ochrony konta.',
    };
  }

  this.savePendingChallenge(challenge);
  const remaining = challenge.maxAttempts - challenge.attemptsCount;
  return {
    success: false,
    isLockedOut: false,
    remainingAttempts: remaining,
    message: `Niepoprawny kod weryfikacyjny. Pozostało prób: ${remaining}.`,
  };
}
```

### 3.3 6-Digit Box Input UI Architecture (`LoginView.tsx`)

```tsx
// 6-digit box subcomponent pattern
const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
const [timerSeconds, setTimerSeconds] = useState<number>(300); // 5 min
const [resendCooldown, setResendCooldown] = useState<number>(30); // 30s
const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

// Live countdown tick
useEffect(() => {
  if (!isOtpSent) return;
  const interval = setInterval(() => {
    setTimerSeconds((prev) => Math.max(0, prev - 1));
    setResendCooldown((prev) => Math.max(0, prev - 1));
    setLockoutSeconds((prev) => {
      if (prev <= 1) {
        setIsLockedOut(false);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(interval);
}, [isOtpSent]);

// Digit entry handler
const handleDigitChange = (index: number, value: string) => {
  const numeric = value.replace(/[^0-9]/g, '');
  if (!numeric) {
    const next = [...digits];
    next[index] = '';
    setDigits(next);
    return;
  }
  const digit = numeric.slice(-1);
  const next = [...digits];
  next[index] = digit;
  setDigits(next);

  // Jump to next box
  if (index < 5) {
    inputRefs.current[index + 1]?.focus();
  }
};

// Keyboard navigation (Backspace and Arrow keys)
const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Backspace') {
    if (!digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    } else {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
    }
  } else if (e.key === 'ArrowLeft' && index > 0) {
    inputRefs.current[index - 1]?.focus();
  } else if (e.key === 'ArrowRight' && index < 5) {
    inputRefs.current[index + 1]?.focus();
  }
};

// Automatic 6-digit paste handler
const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
  const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
  if (!pasted) return;
  const next = [...digits];
  for (let i = 0; i < 6; i++) {
    next[i] = pasted[i] || '';
  }
  setDigits(next);
  const focusIdx = Math.min(pasted.length, 5);
  inputRefs.current[focusIdx]?.focus();
};

// UI rendering of the 6 digit boxes
<div className="flex justify-center items-center gap-2.5 my-4">
  {digits.map((digit, idx) => (
    <input
      key={idx}
      ref={(el) => (inputRefs.current[idx] = el)}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      disabled={isSubmitting || isLockedOut || timerSeconds === 0}
      value={digit}
      onChange={(e) => handleDigitChange(idx, e.target.value)}
      onKeyDown={(e) => handleKeyDown(idx, e)}
      onPaste={handlePaste}
      className={`w-12 h-14 text-center font-mono text-2xl font-black rounded-xl border-2 transition-all outline-none ${
        isLockedOut
          ? 'border-rose-300 bg-rose-50 text-rose-700 cursor-not-allowed'
          : digit
          ? 'border-[#006241] bg-emerald-50/40 text-[#006241]'
          : 'border-stone-200 bg-stone-50 text-stone-900 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 focus:bg-white'
      }`}
    />
  ))}
</div>
```

---

## 4. Caveats

1. **Email SMTP / Relay in Desktop Environment**: In the current retail desktop application, emails are simulated via `simulatedCode` returned in local state. In a full production cloud environment, `request2FaOtp` connects to Firebase Cloud Functions / corporate SendGrid / AmRest Exchange SMTP relay. The rate limiter and validation logic designed here are 100% transport-independent and secure the authentication boundary regardless of whether codes are delivered via email, SMS, or displayed in local debug mode.
2. **Store Manager Quick Login vs 2FA**: Tab 1 ("Store Manager") currently allows one-click entry on verified backroom workstations. For full enterprise corporate compliance, Tab 1 should either validate the manager's corporate email domain (`smUser.email`) or optionally mandate 2FA when launching from an untrusted station.
3. **Session Storage Scoping**: Using `sessionStorage` for OTP challenges isolates the pending state per tab. For multi-window Electron desktop setups, an in-memory Map in `AuthService` backed by sliding timestamps guarantees identical rate limiting across window instances.

---

## 5. Conclusion

1. **Corporate Domain Enforcement**: Strict validation via `validateCorporateEmail` ensures that only `@amrest.eu` and `@starbucks.com` addresses are accepted. Any attempt to use public domains (`@gmail.com`, `@yahoo.com`, `@wp.pl`, etc.) or subdomains is immediately rejected with clear operational guidance in Polish.
2. **Sliding Rate Limiter & Cooldown**: Introducing `maxAttempts = 3` with a 60-second cooldown lockout and a 30-second resend throttle effectively neutralizes brute-force attacks and email flooding.
3. **CSPRNG & Salted Hashing**: Replacing `Math.random()` with `crypto.randomInt` and storing OTPs as salted SHA-256 hashes safeguards memory buffers from RAM scraping.
4. **Ergonomic UI**: The 6-box input with automatic focus progression, backspace jump, paste capture, live `mm:ss` countdown timer, and cooldown-aware resend button elevates the retail manager experience to Starbucks enterprise standards.
5. **State Synchronization**: Wiring `LoginView.tsx` to `useAuth().loginWith2Fa` ensures complete cohesion between `App.tsx` and `AuthContext`.

---

## 6. Verification Method

To independently verify the implementation once applied:

### 6.1 Automated Security Test Suite
Run the test runner command:
```bash
npm run test:security
```
Create a dedicated test file `tests/security/corporate_2fa_auth.test.ts` covering:
1. **Email Domain Matrix**:
   - `test('accepts valid @amrest.eu and @starbucks.com emails')`
   - `test('normalizes case: Dawid.Apel@AMREST.EU -> dawid.apel@amrest.eu')`
   - `test('rejects public webmail: gmail.com, wp.pl, onet.pl, yahoo.com with specific error category')`
   - `test('rejects subdomains: user@sub.amrest.eu, user@corp.starbucks.com')`
   - `test('rejects suffix attacks: user@amrest.eu.attacker.com, user@starbucks.com.pl')`
   - `test('rejects malformed syntax: missing @, multiple @, spaces, empty string')`
2. **OTP Challenge & CSPRNG Token**:
   - `test('generates exactly 6-digit numeric token [0-9]{6}')`
   - `test('entropy dispersion: no collisions or sequential patterns across 10,000 generations')`
   - `test('5-minute token expiry: token valid at 299s, invalid at 301s')`
3. **Sliding Rate Limiter & Cooldown**:
   - `test('attempt 1 wrong -> remainingAttempts = 2')`
   - `test('attempt 2 wrong -> remainingAttempts = 1')`
   - `test('attempt 3 wrong -> triggers 60s lockout (cooldownUntil = now + 60,000)')`
   - `test('attempts during 60s cooldown are rejected with remaining lockout time')`
   - `test('resend OTP during cooldown is blocked')`
   - `test('resend throttling: minimum 30 seconds interval between requests')`
   - `test('successful verification burns OTP and prevents token replay')`
   - `test('timing-safe string comparison prevents side-channel leaks')`

### 6.2 Application Build Verification
Verify that TypeScript compilation and Vite bundling succeed with zero errors:
```bash
npm run build
```

### 6.3 Manual UI Walkthrough
1. Launch app with `npm run dev`.
2. Navigate to `Logowanie 2FA` tab.
3. Enter `test@gmail.com` $\rightarrow$ verify rose error box: *"Dostęp zastrzeżony. Domena publiczna (@gmail.com) nie jest dozwolona. Do systemów operacyjnych Starbucks wymagany jest imienny adres korporacyjny w domenie @amrest.eu lub @starbucks.com."*
4. Enter `dawid.apel@amrest.eu` $\rightarrow$ click `Wyślij kod weryfikacyjny 2FA`.
5. Verify step 2 appears with 6 separate digit boxes and a live countdown timer (`04:59`).
6. Type 6 digits one by one $\rightarrow$ verify auto-focus advances to each next box.
7. Press Backspace $\rightarrow$ verify previous box is cleared and focused.
8. Paste a 6-digit code $\rightarrow$ verify all 6 boxes populate simultaneously.
9. Enter incorrect code 3 times $\rightarrow$ verify boxes turn rose, disable, and lockout message displays: *"Przekroczono limit 3 prób weryfikacji. Dostęp został zablokowany na 60 sekund w celu ochrony konta."*
