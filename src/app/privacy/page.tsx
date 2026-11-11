import Link from "next/link";
import { DocumentShell } from "@/components/layout/DocumentShell";

export const metadata = {
  title: "Privacy policy",
  description:
    "How AIBABA collects, encrypts, uses, retains and deletes account details, birth information, palm photographs, calculations and readings.",
};

const SECTIONS = [
  { id: "scope", title: "Scope" },
  { id: "collect", title: "What we collect" },
  { id: "consent", title: "Consent & purposes" },
  { id: "security", title: "Encryption & security" },
  { id: "sharing", title: "Processors & sharing" },
  { id: "retention", title: "Retention" },
  { id: "rights", title: "Your controls" },
  { id: "cookies", title: "Cookies & sessions" },
  { id: "children", title: "Age requirement" },
  { id: "changes", title: "Changes & contact" },
];

export default function PrivacyPage() {
  return (
    <DocumentShell
      eyebrow="Trust"
      title="Privacy policy"
      intro="AIBABA treats birth information, palm photographs and personal readings as sensitive. This policy explains what is stored, why, where it goes and how you can remove it."
      updated="11 November 2026"
      sections={SECTIONS}
      cta={{ href: "/settings", label: "Open privacy settings", secondary: { href: "/methodology", label: "Read the methodology" } }}
    >
      <h2 id="scope">Scope</h2>
      <p>
        This policy covers the AIBABA Complete Life Reading application and the account that supports it. It
        does not cover third-party sites you reach through an external link. The application is operated by the
        entity deploying it; the contact details below should be replaced with the operator&apos;s registered
        details before a public launch.
      </p>

      <h2 id="collect">What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address, a bcrypt password hash (12 rounds), preferred
          language, account status and role.
        </li>
        <li>
          <strong>Profile data:</strong> display name, country and timezone where you provide them.
        </li>
        <li>
          <strong>Birth information:</strong> full name and date of birth (encrypted), birth time and accuracy,
          birthplace name, latitude, longitude and IANA timezone. This is used for deterministic numerology and
          Vedic astrology.
        </li>
        <li>
          <strong>Palm photographs:</strong> the images you upload, plus derived width, height, checksum, quality
          assessment and structured observations. Images are stored privately and re-encoded to remove
          unnecessary EXIF metadata.
        </li>
        <li>
          <strong>Calculations and reports:</strong> numerology steps and results, astrology positions and
          settings, palm observations, AI-assisted interpretation, report versions and version identifiers.
        </li>
        <li>
          <strong>Conversations:</strong> follow-up messages you send about your own reading and the replies.
        </li>
        <li>
          <strong>Consent records:</strong> the purpose, consent version, whether consent was granted, and the
          grant or withdrawal time.
        </li>
        <li>
          <strong>Operational data:</strong> hashed session tokens, background-job status, and audit events. Audit
          metadata records actions and identifiers — never reading content, birth details, images or secrets.
        </li>
      </ul>
      <p>
        We do not ask for gender, caste, religion, sexuality, health information or government identifiers
        because the supported calculations do not require them.
      </p>

      <h2 id="consent">Consent and purposes</h2>
      <p>
        Each processing purpose is consented to separately. Essential purposes are not bundled with optional
        research or product-improvement consent.
      </p>
      <ul>
        <li>
          <strong>Birth-detail processing:</strong> required to calculate numerology and Vedic astrology.
        </li>
        <li>
          <strong>AI interpretation:</strong> required to send selected, validated information to the configured
          AI provider for explanation. The provider does not receive your password or images unless palm
          interpretation is explicitly enabled and consented to.
        </li>
        <li>
          <strong>Palm-photograph processing:</strong> required for palm observation. Declining it allows a
          reading without palmistry.
        </li>
        <li>
          <strong>Reading history:</strong> required to save and revisit a report. Declining it allows processing
          without long-term history where the application supports that mode.
        </li>
        <li>
          <strong>Optional research:</strong> off by default and never required for the service.
        </li>
      </ul>
      <p>
        You can withdraw consent from <Link href="/settings">Settings</Link>. Withdrawal stops future processing
        but does not retroactively invalidate a report that was already produced with your consent.
      </p>

      <h2 id="security">Encryption and security</h2>
      <ul>
        <li>Sensitive birth fields are encrypted at rest with AES-256-GCM and a versioned payload format.</li>
        <li>Passwords are hashed with bcrypt; plaintext passwords are never stored or logged.</li>
        <li>
          Sessions use random tokens stored as SHA-256 hashes in the database and delivered in HTTP-only,
          SameSite cookies. Revoking a session invalidates it immediately.
        </li>
        <li>
          Mutating API routes enforce same-origin requests, rate limits and server-side ownership checks.
        </li>
        <li>
          Palm images and exports are served through short-lived HMAC-signed URLs, not public object URLs.
        </li>
        <li>
          Administrative access is role-based and audited. Administrators see operational metadata, not reading
          content or birth details.
        </li>
        <li>Database access uses parameterised queries through the ORM; stack traces are never returned to clients.</li>
      </ul>
      <p>
        No system is perfectly secure. If you believe your account has been compromised, change your password
        and contact the operator immediately.
      </p>

      <h2 id="sharing">Processors and sharing</h2>
      <p>We do not sell personal data and we do not run advertising profiles. Data may be processed by:</p>
      <ul>
        <li>
          <strong>AI provider:</strong> OpenAI or Google Gemini when configured by the operator; otherwise a
          local deterministic interpreter runs on the server.
        </li>
        <li>
          <strong>Hosting, database, storage and email providers</strong> used to run this deployment.
        </li>
        <li>
          <strong>Payment provider:</strong> only if payments are enabled. Payments are disabled in the default
          local configuration, and no card data is stored by AIBABA.
        </li>
        <li>
          <strong>Authorities:</strong> only where a valid legal obligation requires disclosure, and only to the
          minimum extent required.
        </li>
      </ul>
      <p>
        An AI provider receives the validated calculation or observation data needed to answer, plus the
        language setting. Do not include passwords, government identifiers or unrelated sensitive information
        in follow-up questions.
      </p>

      <h2 id="retention">Retention</h2>
      <p>
        Readings, reports and private assets are retained while your account is active, subject to the
        retention policy configured by the operator (365 days for assets in the default configuration). Audit
        events are retained for operational security. Deleting a reading removes its reports, calculations,
        conversations and assets; deleting your account anonymises the account record and removes associated
        personal data, subject to any minimum legal retention obligation.
      </p>
      <p>
        Shared report links expire automatically (72 hours by default) and can be revoked at any time.
      </p>

      <h2 id="rights">Your controls</h2>
      <p>
        From <Link href="/settings">Privacy &amp; settings</Link> you can update your profile, review and change
        consent, export your data as JSON, delete an individual reading, or delete your account after confirming
        your password. Deletion is designed to be irreversible.
      </p>
      <p>
        Depending on where you live, you may also have rights to access, correct, restrict or object to
        processing, or to lodge a complaint with a data-protection authority. Contact the operator to exercise a
        right that the interface does not cover.
      </p>

      <h2 id="cookies">Cookies and sessions</h2>
      <p>
        The application uses a single essential session cookie to keep you signed in. It is HTTP-only and
        SameSite-protected. No advertising or third-party analytics cookies are set by default. Clearing cookies
        signs you out; it does not delete your stored readings.
      </p>

      <h2 id="children">Age requirement</h2>
      <p>
        The service is intended for adults aged 18 or over. Do not create an account or submit another
        person&apos;s birth details or palm photographs without their lawful permission.
      </p>

      <h2 id="changes">Changes and contact</h2>
      <p>
        Material changes to this policy will be reflected in the &ldquo;last updated&rdquo; date and, where
        appropriate, communicated in the application before they take effect. Continued use after a change
        means you accept the updated policy.
      </p>
      <p>
        Privacy questions and rights requests: <strong>privacy@aibaba.app</strong>. Security reports:{" "}
        <strong>security@aibaba.app</strong>. Replace these addresses with the operator&apos;s monitored contact
        details before production launch.
      </p>
      <p>
        This policy is a product document prepared for review by qualified legal professionals. It is not legal
        advice and does not by itself establish compliance with any particular jurisdiction.
      </p>
    </DocumentShell>
  );
}
