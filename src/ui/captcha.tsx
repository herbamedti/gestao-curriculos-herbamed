import Script from 'next/script';
export function Captcha({ siteKey }: { siteKey?: string }) {
  return <><label className="honey" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>{siteKey && <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" /></>}</>;
}
