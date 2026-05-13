import pg from "pg";
const { Client } = pg;

const HTML_EN = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f2b46;line-height:1.6;max-width:520px;margin:0 auto;">
  <div style="background:#0f2b46;padding:20px 24px;border-radius:16px 16px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="vertical-align:middle;width:48px;padding-right:12px;">
          <img src="https://www.app.africandatalayer.com/email-logo.png" width="40" height="40" alt="African Data Layer" style="display:block;border:0;border-radius:8px;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="color:#f4c317;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">African Data Layer</div>
          <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;">Welcome {firstName}</h1>
        </td>
      </tr>
    </table>
  </div>
  <div style="background:#ffffff;padding:24px;border:1px solid #e6ecf2;border-top:0;border-radius:0 0 16px 16px;">
    <p style="margin:0 0 16px;">Thanks for joining the field pilot in {city}. A few reminders before your first capture:</p>
    <ul style="padding-left:20px;margin:0 0 16px;">
      <li>Enable GPS and camera before heading out.</li>
      <li>Work offline without worry. The queue syncs automatically.</li>
      <li>Each submission earns XP and lifts your trust tier.</li>
    </ul>
    <p style="margin:0 0 24px;">Your contact: <strong>support@app.africandatalayer.com</strong></p>
    <p style="text-align:center;margin:0 0 8px;">
      <a href="https://www.app.africandatalayer.com" style="display:inline-block;background:#c86b4a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;">Open the app</a>
    </p>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#8b97a8;text-align:center;">2026 African Data Layer &middot; Douala, Cameroon &middot; Tier {trustTier}</p>
</div>`;

const HTML_FR = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f2b46;line-height:1.6;max-width:520px;margin:0 auto;">
  <div style="background:#0f2b46;padding:20px 24px;border-radius:16px 16px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="vertical-align:middle;width:48px;padding-right:12px;">
          <img src="https://www.app.africandatalayer.com/email-logo.png" width="40" height="40" alt="African Data Layer" style="display:block;border:0;border-radius:8px;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="color:#f4c317;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">African Data Layer</div>
          <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;">Bienvenue {firstName}</h1>
        </td>
      </tr>
    </table>
  </div>
  <div style="background:#ffffff;padding:24px;border:1px solid #e6ecf2;border-top:0;border-radius:0 0 16px 16px;">
    <p style="margin:0 0 16px;">Merci de rejoindre le pilote terrain a {city}. Quelques rappels avant votre premiere capture :</p>
    <ul style="padding-left:20px;margin:0 0 16px;">
      <li>Activez le GPS et la camera avant de sortir.</li>
      <li>Travaillez hors-ligne sans crainte. La file se synchronise automatiquement.</li>
      <li>Chaque soumission rapporte des XP et fait monter votre niveau de confiance.</li>
    </ul>
    <p style="margin:0 0 24px;">Votre contact : <strong>support@app.africandatalayer.com</strong></p>
    <p style="text-align:center;margin:0 0 8px;">
      <a href="https://www.app.africandatalayer.com" style="display:inline-block;background:#c86b4a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;">Ouvrir l'application</a>
    </p>
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#8b97a8;text-align:center;">2026 African Data Layer &middot; Douala, Cameroun &middot; Niveau {trustTier}</p>
</div>`;

const TEXT_EN = `Welcome {firstName} to African Data Layer.

Thanks for joining the field pilot in {city}. A few reminders:
- Enable GPS and camera before heading out
- Work offline. The queue syncs automatically.
- Each submission earns XP and lifts your trust tier.

Contact: support@app.africandatalayer.com
Open the app: https://www.app.africandatalayer.com

- African Data Layer
Tier {trustTier}`;

const TEXT_FR = `Bienvenue {firstName} sur African Data Layer.

Merci de rejoindre le pilote terrain a {city}. Quelques rappels :
- Activez GPS et camera avant de sortir
- Travaillez hors-ligne. La file synchronise automatiquement.
- Chaque soumission rapporte des XP et alimente votre niveau de confiance.

Contact : support@app.africandatalayer.com
Ouvrir l'application : https://www.app.africandatalayer.com

- African Data Layer
Niveau {trustTier}`;

const c = new Client({
  connectionString: "postgres://postgres.rhslszcwchyzkaooxzht:ApcWC6XbmfKBbp6S@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});

await c.connect();
const r = await c.query(
  `INSERT INTO public.email_templates (slug, name, subject_en, subject_fr, html_en, html_fr, text_en, text_fr, variables, created_by)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
   ON CONFLICT (slug) DO UPDATE SET
     name = EXCLUDED.name,
     subject_en = EXCLUDED.subject_en,
     subject_fr = EXCLUDED.subject_fr,
     html_en = EXCLUDED.html_en,
     html_fr = EXCLUDED.html_fr,
     text_en = EXCLUDED.text_en,
     text_fr = EXCLUDED.text_fr,
     variables = EXCLUDED.variables,
     updated_at = NOW()
   RETURNING id, slug, name`,
  [
    "agent_welcome",
    "Agent welcome",
    "Welcome to the African Data Layer pilot",
    "Bienvenue dans le pilote African Data Layer",
    HTML_EN,
    HTML_FR,
    TEXT_EN,
    TEXT_FR,
    JSON.stringify(["firstName", "city", "trustTier"]),
    "daphatpharm@icloud.com",
  ],
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
