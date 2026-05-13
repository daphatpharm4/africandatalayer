import { renderEmailShell, renderPlainTextShell } from "./shell.js";

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
  const intro = `We received a request to reset your password. Use the button below to choose a new one. The link expires in ${ttlMinutes} minutes and can only be used once.`;
  const ignore = "If you didn't request this reset, you can safely ignore this email — your password will not change.";
  const html = renderEmailShell({
    preheader: `Reset link valid for ${ttlMinutes} minutes.`,
    title: subject,
    bodyHtml: `<p style="margin:0 0 16px;">${intro}</p>`,
    cta: { label: "Set a new password", href: resetUrl },
    fallbackUrl: resetUrl,
    fallbackLabel: "If the button doesn't work, paste this link into your browser:",
    footerNote: ignore,
    language: "en",
  });
  const text = renderPlainTextShell({
    title: subject,
    bodyLines: [intro, "", ignore],
    cta: { label: "Set a new password", href: resetUrl },
    language: "en",
  });
  return { subject, html, text };
}

function frenchEmail(resetUrl: string, ttlMinutes: number): PasswordResetEmailContent {
  const subject = "Réinitialiser votre mot de passe African Data Layer";
  const intro = `Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez le bouton ci-dessous pour en choisir un nouveau. Le lien expire dans ${ttlMinutes} minutes et ne peut être utilisé qu'une seule fois.`;
  const ignore = "Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail — votre mot de passe ne changera pas.";
  const html = renderEmailShell({
    preheader: `Lien de réinitialisation valable ${ttlMinutes} minutes.`,
    title: subject,
    bodyHtml: `<p style="margin:0 0 16px;">${intro}</p>`,
    cta: { label: "Définir un nouveau mot de passe", href: resetUrl },
    fallbackUrl: resetUrl,
    fallbackLabel: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    footerNote: ignore,
    language: "fr",
  });
  const text = renderPlainTextShell({
    title: subject,
    bodyLines: [intro, "", ignore],
    cta: { label: "Définir un nouveau mot de passe", href: resetUrl },
    language: "fr",
  });
  return { subject, html, text };
}
