export interface PasswordResetEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildPasswordResetEmail(params: {
  resetUrl: string;
  ttlMinutes: number;
  language: "en" | "fr";
}): PasswordResetEmailContent {
  if (params.language === "fr") {
    return frenchEmail(params.resetUrl, params.ttlMinutes);
  }
  return englishEmail(params.resetUrl, params.ttlMinutes);
}

function englishEmail(resetUrl: string, ttlMinutes: number): PasswordResetEmailContent {
  const subject = "Reset your African Data Layer password";
  const text = [
    "Reset your African Data Layer password",
    "",
    "Use the link below to set a new password. The link expires in " + ttlMinutes + " minutes and can only be used once.",
    "",
    resetUrl,
    "",
    "If you did not request this reset, ignore this email — your password will not change.",
    "",
    "— African Data Layer",
  ].join("\n");
  const html = renderHtml({
    title: subject,
    intro: `Use the button below to set a new password. The link expires in ${ttlMinutes} minutes and can only be used once.`,
    cta: "Set a new password",
    resetUrl,
    fallbackLine: "If the button doesn't work, paste this link into your browser:",
    ignoreLine: "If you did not request this reset, ignore this email — your password will not change.",
  });
  return { subject, html, text };
}

function frenchEmail(resetUrl: string, ttlMinutes: number): PasswordResetEmailContent {
  const subject = "Réinitialiser votre mot de passe African Data Layer";
  const text = [
    "Réinitialiser votre mot de passe African Data Layer",
    "",
    "Utilisez le lien ci-dessous pour définir un nouveau mot de passe. Le lien expire dans " + ttlMinutes + " minutes et ne peut être utilisé qu'une fois.",
    "",
    resetUrl,
    "",
    "Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe ne changera pas.",
    "",
    "— African Data Layer",
  ].join("\n");
  const html = renderHtml({
    title: subject,
    intro: `Utilisez le bouton ci-dessous pour définir un nouveau mot de passe. Le lien expire dans ${ttlMinutes} minutes et ne peut être utilisé qu'une fois.`,
    cta: "Définir un nouveau mot de passe",
    resetUrl,
    fallbackLine: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    ignoreLine: "Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe ne changera pas.",
  });
  return { subject, html, text };
}

function escape(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHtml(params: {
  title: string;
  intro: string;
  cta: string;
  resetUrl: string;
  fallbackLine: string;
  ignoreLine: string;
}): string {
  const safeUrl = escape(params.resetUrl);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,system-ui,sans-serif;color:#0f2b46;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
            <tr><td>
              <h1 style="margin:0 0 16px;font-size:20px;color:#0f2b46;">${escape(params.title)}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a5b70;">${escape(params.intro)}</p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0f2b46;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;">${escape(params.cta)}</a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#6b7a8c;">${escape(params.fallbackLine)}</p>
              <p style="margin:0 0 24px;font-size:13px;word-break:break-all;color:#0f2b46;">
                <a href="${safeUrl}" style="color:#0f2b46;">${safeUrl}</a>
              </p>
              <p style="margin:0;font-size:13px;color:#6b7a8c;">${escape(params.ignoreLine)}</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
