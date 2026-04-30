# Supabase Auth email templates

## Files

- `magic-link.html` — branded OTP / magic-link email for `/admin` sign-in.

## How to install (one-time, per project)

1. Open the Supabase dashboard → **Authentication → Email Templates**.
2. Select **Magic Link** (this is what `signInWithOtp` uses).
3. Set **Subject heading** to: `Your Eurovision Games admin code`
4. Open `magic-link.html` in this directory, copy the entire body, paste into the **Message body** editor (HTML mode).
5. Save.

## Custom From address (recommended)

By default Supabase sends from `noreply@mail.app.supabase.io`, which trips spam filters and looks unbranded. To send from `noreply@eurovision.games`:

1. Supabase dashboard → **Project Settings → Auth → SMTP Settings**.
2. Toggle **Enable Custom SMTP**.
3. Use Resend (recommended), Postmark, or SendGrid:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (STARTTLS)
   - Username: `resend`
   - Password: your Resend API key (`re_...`)
   - Sender email: `noreply@eurovision.games`
   - Sender name: `Eurovision Games`
4. Set up SPF + DKIM for `eurovision.games` per Resend's domain verification flow.

## Variables available in templates

Supabase substitutes these tokens at send time:

| Token | Meaning |
|---|---|
| `{{ .Token }}` | 6-digit OTP code |
| `{{ .ConfirmationURL }}` | Magic-link URL (one-click sign in) |
| `{{ .Email }}` | Recipient email |
| `{{ .SiteURL }}` | Project's configured Site URL |

## Testing

Send a test OTP:

```ts
await supabase.auth.signInWithOtp({ email: 'tsokid@gmail.com' });
```

Check inbox for branded email. If still arriving from `noreply@mail.app.supabase.io`, the SMTP override didn't take — re-check dashboard.
