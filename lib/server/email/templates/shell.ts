export interface EmailShellParams {
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  fallbackUrl?: string;
  fallbackLabel?: string;
  footerNote?: string;
  language: "en" | "fr";
  brandHost?: string;
}

const DEFAULT_BRAND_HOST = "https://www.app.africandatalayer.com";

function escape(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderEmailShell(params: EmailShellParams): string {
  const host = (params.brandHost ?? DEFAULT_BRAND_HOST).replace(/\/$/, "");
  const logoUrl = `${host}/email-logo.png`;
  const tagline =
    params.language === "fr"
      ? "Cartographier l'Afrique, point par point."
      : "Mapping Africa, one point at a time.";
  const footerCopy =
    params.language === "fr"
      ? `&copy; ${new Date().getFullYear()} African Data Layer &middot; Douala, Cameroun`
      : `&copy; ${new Date().getFullYear()} African Data Layer &middot; Douala, Cameroon`;
  const transactionalNotice =
    params.language === "fr"
      ? "Vous recevez cet e-mail parce qu'un compte est associé à cette adresse."
      : "You're receiving this because an account is linked to this address.";

  const ctaHtml = params.cta
    ? `
              <tr>
                <td align="center" style="padding:8px 0 24px;">
                  <a href="${escape(params.cta.href)}" style="display:inline-block;padding:14px 28px;background:#0f2b46;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;letter-spacing:0.2px;">${escape(params.cta.label)}</a>
                </td>
              </tr>`
    : "";

  const fallbackHtml = params.fallbackUrl
    ? `
              <tr>
                <td style="padding:0 0 16px;font-size:12px;line-height:1.6;color:#6b7a8c;">
                  ${escape(params.fallbackLabel ?? (params.language === "fr" ? "Si le bouton ne fonctionne pas, copiez ce lien :" : "If the button doesn't work, paste this link:"))}
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 24px;font-size:12px;word-break:break-all;">
                  <a href="${escape(params.fallbackUrl)}" style="color:#0f2b46;text-decoration:underline;">${escape(params.fallbackUrl)}</a>
                </td>
              </tr>`
    : "";

  const footerNoteHtml = params.footerNote
    ? `<p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#6b7a8c;">${escape(params.footerNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="${params.language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escape(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f2b46;">
    <div style="display:none;font-size:1px;color:#f2f6fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(params.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f6fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">
            <tr>
              <td style="padding:0 4px 20px;" align="left">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:12px;vertical-align:middle;">
                      <img src="${escape(logoUrl)}" width="36" height="36" alt="African Data Layer" style="display:block;border:0;outline:none;border-radius:8px;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:15px;font-weight:700;color:#0f2b46;letter-spacing:0.2px;">African Data Layer</div>
                      <div style="font-size:11px;font-weight:600;color:#c86b4a;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;">${escape(tagline)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-radius:20px;padding:32px;box-shadow:0 1px 3px rgba(15,43,70,0.04),0 8px 24px rgba(15,43,70,0.06);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 8px;">
                      <div style="width:32px;height:3px;background:#c86b4a;border-radius:99px;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 16px;">
                      <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f2b46;font-weight:700;letter-spacing:-0.2px;">${escape(params.title)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px;font-size:15px;line-height:1.65;color:#4a5b70;">
                      ${params.bodyHtml}
                    </td>
                  </tr>
                  ${ctaHtml}
                  ${fallbackHtml}
                  <tr>
                    <td style="padding:16px 0 0;border-top:1px solid #e6ecf2;">
                      ${footerNoteHtml}
                      <p style="margin:0;font-size:12px;line-height:1.6;color:#8b97a8;">${escape(transactionalNotice)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 4px 0;" align="center">
                <p style="margin:0 0 6px;font-size:12px;color:#8b97a8;line-height:1.6;">${footerCopy}</p>
                <p style="margin:0;font-size:12px;color:#8b97a8;line-height:1.6;">
                  <a href="${host}" style="color:#0f2b46;text-decoration:none;font-weight:600;">app.africandatalayer.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderPlainTextShell(params: {
  title: string;
  bodyLines: string[];
  cta?: { label: string; href: string };
  footerNote?: string;
  language: "en" | "fr";
}): string {
  const lines: string[] = [];
  lines.push(params.title);
  lines.push("");
  lines.push(...params.bodyLines);
  if (params.cta) {
    lines.push("");
    lines.push(`${params.cta.label}: ${params.cta.href}`);
  }
  if (params.footerNote) {
    lines.push("");
    lines.push(params.footerNote);
  }
  lines.push("");
  lines.push("— African Data Layer");
  lines.push(
    params.language === "fr"
      ? "Cartographier l'Afrique, point par point."
      : "Mapping Africa, one point at a time.",
  );
  return lines.join("\n");
}
