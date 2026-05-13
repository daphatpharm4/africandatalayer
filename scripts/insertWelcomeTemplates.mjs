import pg from "pg";
const { Client } = pg;

const HEADER = (titleEn, titleFr, isFr) => `<div style="background:#0f2b46;padding:20px 24px;border-radius:16px 16px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr>
        <td style="vertical-align:middle;width:48px;padding-right:12px;">
          <img src="https://www.app.africandatalayer.com/email-logo.png" width="40" height="40" alt="African Data Layer" style="display:block;border:0;border-radius:8px;" />
        </td>
        <td style="vertical-align:middle;">
          <div style="color:#f4c317;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">African Data Layer</div>
          <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;">${isFr ? titleFr : titleEn}</h1>
        </td>
      </tr>
    </table>
  </div>`;

const FOOTER = (isFr) => `<p style="margin:16px 0 0;font-size:12px;color:#8b97a8;text-align:center;">2026 African Data Layer &middot; Douala, ${isFr ? "Cameroun" : "Cameroon"}</p>`;

const SHELL = (body, titleEn, titleFr, isFr) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f2b46;line-height:1.6;max-width:520px;margin:0 auto;">${HEADER(titleEn, titleFr, isFr)}<div style="background:#ffffff;padding:24px;border:1px solid #e6ecf2;border-top:0;border-radius:0 0 16px 16px;">${body}</div>${FOOTER(isFr)}</div>`;

const CTA = (label, href) =>
  `<p style="text-align:center;margin:8px 0;"><a href="${href}" style="display:inline-block;background:#c86b4a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600;">${label}</a></p>`;

const APP_URL = "https://www.app.africandatalayer.com";

// ---- AGENT (existing, refreshed) ----
const AGENT = {
  slug: "agent_welcome",
  name: "Agent welcome",
  subjectEn: "Welcome to the African Data Layer pilot",
  subjectFr: "Bienvenue dans le pilote African Data Layer",
  bodyEn: `<p style="margin:0 0 16px;">Thanks for joining the field pilot in {city}. A few reminders before your first capture:</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li>Enable GPS and camera before heading out.</li>
    <li>Work offline. The queue syncs automatically when you reconnect.</li>
    <li>Each submission earns XP and lifts your trust tier.</li>
  </ul>
  <p style="margin:0 0 24px;">Your contact: <strong>support@app.africandatalayer.com</strong></p>
  ${CTA("Open the app", APP_URL)}`,
  bodyFr: `<p style="margin:0 0 16px;">Merci de rejoindre le pilote terrain a {city}. Quelques rappels avant votre premiere capture :</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li>Activez le GPS et la camera avant de sortir.</li>
    <li>Travaillez hors-ligne. La file synchronise automatiquement.</li>
    <li>Chaque soumission rapporte des XP et fait monter votre niveau de confiance.</li>
  </ul>
  <p style="margin:0 0 24px;">Votre contact : <strong>support@app.africandatalayer.com</strong></p>
  ${CTA("Ouvrir l'application", APP_URL)}`,
  textEn: `Welcome {firstName} to African Data Layer.

Thanks for joining the field pilot in {city}. A few reminders:
- Enable GPS and camera before heading out
- Work offline. The queue syncs automatically.
- Each submission earns XP and lifts your trust tier.

Contact: support@app.africandatalayer.com
Open the app: ${APP_URL}

- African Data Layer
Tier {trustTier}`,
  textFr: `Bienvenue {firstName} sur African Data Layer.

Merci de rejoindre le pilote terrain a {city}. Quelques rappels :
- Activez GPS et camera avant de sortir
- Travaillez hors-ligne. La file synchronise automatiquement.
- Chaque soumission rapporte des XP et alimente votre niveau de confiance.

Contact : support@app.africandatalayer.com
Ouvrir l'application : ${APP_URL}

- African Data Layer
Niveau {trustTier}`,
  variables: ["firstName", "city", "trustTier"],
};

// ---- ADMIN ----
const ADMIN = {
  slug: "admin_welcome",
  name: "Admin welcome",
  subjectEn: "Your African Data Layer admin access is live",
  subjectFr: "Votre acces administrateur African Data Layer est actif",
  bodyEn: `<p style="margin:0 0 16px;">Welcome {firstName}. You now have admin access to the African Data Layer cockpit.</p>
  <p style="margin:0 0 12px;font-weight:600;color:#0f2b46;">Your responsibilities:</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li>Review the submission queue daily. Flag fraud and merge duplicates.</li>
    <li>Approve assignments and monitor agent trust tiers.</li>
    <li>Investigate flagged PII and act on risk signals fast.</li>
  </ul>
  <p style="margin:0 0 12px;">Useful entry points: cockpit review, assignments, fraud signals, communications.</p>
  <p style="margin:0 0 24px;">Questions? <strong>support@app.africandatalayer.com</strong></p>
  ${CTA("Open admin cockpit", APP_URL)}`,
  bodyFr: `<p style="margin:0 0 16px;">Bienvenue {firstName}. Vous avez maintenant l'acces administrateur du cockpit African Data Layer.</p>
  <p style="margin:0 0 12px;font-weight:600;color:#0f2b46;">Vos responsabilites :</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li>Examinez la file de soumissions chaque jour. Signalez les fraudes, fusionnez les doublons.</li>
    <li>Validez les affectations et surveillez les niveaux de confiance.</li>
    <li>Traitez rapidement les signalements PII et les signaux de risque.</li>
  </ul>
  <p style="margin:0 0 12px;">Acces utiles : cockpit revue, affectations, signalements, communications.</p>
  <p style="margin:0 0 24px;">Questions ? <strong>support@app.africandatalayer.com</strong></p>
  ${CTA("Ouvrir le cockpit", APP_URL)}`,
  textEn: `Welcome {firstName} to African Data Layer admin.

You now have admin access. Daily checklist:
- Review the submission queue
- Approve assignments and monitor trust tiers
- Investigate PII flags and risk signals

Open the admin cockpit: ${APP_URL}
Contact: support@app.africandatalayer.com

- African Data Layer`,
  textFr: `Bienvenue {firstName} sur l'administration African Data Layer.

Acces administrateur actif. Routine quotidienne :
- Examiner la file de soumissions
- Valider les affectations, surveiller les niveaux de confiance
- Traiter les signalements PII et les signaux de risque

Ouvrir le cockpit : ${APP_URL}
Contact : support@app.africandatalayer.com

- African Data Layer`,
  variables: ["firstName"],
};

// ---- CLIENT ----
const CLIENT = {
  slug: "client_welcome",
  name: "Client welcome",
  subjectEn: "Welcome to your African Data Layer dashboard",
  subjectFr: "Bienvenue sur votre tableau de bord African Data Layer",
  bodyEn: `<p style="margin:0 0 16px;">Welcome {firstName}. Your African Data Layer dashboard is ready.</p>
  <p style="margin:0 0 12px;">You can now explore:</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li><strong>Delta dashboard</strong> &mdash; verified weekly changes across infrastructure and price signals in {city}.</li>
    <li><strong>Map view</strong> &mdash; ground-truth points captured by field agents.</li>
    <li><strong>Exports</strong> &mdash; CSV downloads for your own analysis pipelines.</li>
  </ul>
  <p style="margin:0 0 24px;">Every point in your dashboard carries a provenance trail: agent, timestamp, EXIF, GPS check, trust tier. Click a point to see the source.</p>
  ${CTA("Open the dashboard", APP_URL)}
  <p style="margin:24px 0 0;font-size:13px;color:#6b7a8c;">Questions about the data, methodology, or integrations? Reply to this email or write to <strong>support@app.africandatalayer.com</strong>.</p>`,
  bodyFr: `<p style="margin:0 0 16px;">Bienvenue {firstName}. Votre tableau de bord African Data Layer est pret.</p>
  <p style="margin:0 0 12px;">Vous pouvez maintenant explorer :</p>
  <ul style="padding-left:20px;margin:0 0 16px;">
    <li><strong>Tableau Delta</strong> &mdash; evolutions hebdomadaires verifiees des infrastructures et des prix a {city}.</li>
    <li><strong>Vue carte</strong> &mdash; points terrain captures par les agents.</li>
    <li><strong>Exports</strong> &mdash; telechargements CSV pour vos analyses.</li>
  </ul>
  <p style="margin:0 0 24px;">Chaque point porte sa trace : agent, horodatage, EXIF, controle GPS, niveau de confiance. Cliquez un point pour voir la source.</p>
  ${CTA("Ouvrir le tableau de bord", APP_URL)}
  <p style="margin:24px 0 0;font-size:13px;color:#6b7a8c;">Questions sur les donnees, la methodologie ou les integrations ? Repondez a cet e-mail ou ecrivez a <strong>support@app.africandatalayer.com</strong>.</p>`,
  textEn: `Welcome {firstName} to African Data Layer.

Your dashboard is ready. Explore:
- Delta dashboard: verified weekly changes in {city}
- Map view: ground-truth points captured by field agents
- Exports: CSV downloads for your analytics

Every point carries provenance: agent, timestamp, EXIF, GPS check, trust tier.

Open the dashboard: ${APP_URL}
Questions? support@app.africandatalayer.com

- African Data Layer`,
  textFr: `Bienvenue {firstName} sur African Data Layer.

Votre tableau de bord est pret. A explorer :
- Tableau Delta : evolutions hebdomadaires a {city}
- Vue carte : points terrain captures par les agents
- Exports : telechargements CSV

Chaque point porte sa trace : agent, horodatage, EXIF, controle GPS, niveau de confiance.

Ouvrir : ${APP_URL}
Questions ? support@app.africandatalayer.com

- African Data Layer`,
  variables: ["firstName", "city"],
};

const TEMPLATES = [AGENT, ADMIN, CLIENT].map((t) => ({
  ...t,
  htmlEn: SHELL(t.bodyEn, t.subjectEn, t.subjectFr, false),
  htmlFr: SHELL(t.bodyFr, t.subjectEn, t.subjectFr, true),
}));

const c = new Client({
  connectionString: "postgres://postgres.rhslszcwchyzkaooxzht:ApcWC6XbmfKBbp6S@aws-1-us-east-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
});

await c.connect();
for (const t of TEMPLATES) {
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
     RETURNING slug, name`,
    [
      t.slug,
      t.name,
      t.subjectEn,
      t.subjectFr,
      t.htmlEn,
      t.htmlFr,
      t.textEn,
      t.textFr,
      JSON.stringify(t.variables),
      "daphatpharm@icloud.com",
    ],
  );
  console.log("upserted:", r.rows[0]);
}
await c.end();
