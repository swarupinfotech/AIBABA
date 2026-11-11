import Link from "next/link";
import { DocumentShell } from "@/components/layout/DocumentShell";

export const metadata = {
  title: "Terms of use",
  description:
    "The terms that govern use of AIBABA Complete Life Reading, including eligibility, acceptable use, AI limitations and liability.",
};

const SECTIONS = [
  { id: "agreement", title: "Agreement" },
  { id: "eligibility", title: "Eligibility" },
  { id: "service", title: "The service" },
  { id: "advice", title: "Not professional advice" },
  { id: "accounts", title: "Accounts" },
  { id: "acceptable", title: "Acceptable use" },
  { id: "ai", title: "AI & providers" },
  { id: "payments", title: "Payments" },
  { id: "ip", title: "Intellectual property" },
  { id: "availability", title: "Availability" },
  { id: "liability", title: "Liability" },
  { id: "termination", title: "Termination" },
  { id: "changes", title: "Changes & contact" },
];

export default function TermsPage() {
  return (
    <DocumentShell
      eyebrow="Trust"
      title="Terms of use"
      intro="These terms explain what AIBABA provides, what it does not provide, and the responsibilities that come with using it. Please read them before creating an account."
      updated="11 November 2026"
      sections={SECTIONS}
      cta={{ href: "/register", label: "Create an account", secondary: { href: "/privacy", label: "Privacy policy" } }}
    >
      <h2 id="agreement">Agreement</h2>
      <p>
        By accessing or using AIBABA Complete Life Reading, you agree to these terms and to the{" "}
        <Link href="/privacy">privacy policy</Link>. If you do not agree, do not use the service. These terms are
        a product document prepared for review by qualified legal professionals and should be adapted to the
        operator&apos;s jurisdiction before launch.
      </p>

      <h2 id="eligibility">Eligibility</h2>
      <p>
        You must be at least 18 years old and legally able to enter into a contract. You may submit birth details
        or palm photographs only for yourself, or for another person who has given you lawful permission to do
        so. The service is not directed at children.
      </p>

      <h2 id="service">The service</h2>
      <p>
        AIBABA combines three traditional interpretation methods: palm observation from photographs you upload,
        deterministic Chaldean or Pythagorean numerology, and sidereal Vedic astrology calculated from birth
        details. AI-assisted language explains the validated inputs in a structured report.
      </p>
      <p>
        The service is provided for personal interest and reflection. Features, supported methods and calculation
        versions may change as the product is improved. A method that cannot be completed is labelled unavailable
        or limited rather than replaced with invented content.
      </p>

      <h2 id="advice">Not professional advice</h2>
      <p>
        AIBABA does not provide medical, psychological, legal, financial, investment, employment or relationship
        advice. Traditional interpretations are not scientifically verified predictions and must not be used to
        make important decisions. Always consult a qualified professional for medical, legal or financial
        matters.
      </p>
      <p>
        The service does not predict death, lifespan, disease, pregnancy, criminal behaviour or unavoidable
        events, and it does not guarantee money, marriage, health, employment or any other outcome. If you are in
        crisis or at risk of harm, contact local emergency services or a qualified crisis line.
      </p>

      <h2 id="accounts">Accounts</h2>
      <p>
        You are responsible for keeping your password confidential and for activity under your account. Use a
        unique password and tell the operator promptly if you suspect unauthorised access. You must provide
        accurate information; calculations based on incorrect birth details will be incorrect.
      </p>
      <p>
        You may delete your account at any time from <Link href="/settings">Settings</Link>. Deletion is
        irreversible and removes associated readings, reports, conversations and private assets, subject to the
        retention terms in the privacy policy.
      </p>

      <h2 id="acceptable">Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload another person&apos;s palm photograph or birth details without lawful permission;</li>
        <li>use the service for identity recognition, biometric identification or surveillance;</li>
        <li>attempt to access another user&apos;s account, readings, images or reports;</li>
        <li>probe, scan, overload, reverse engineer or circumvent security, rate limits or access controls;</li>
        <li>upload malware, unlawful content or material that infringes another person&apos;s rights;</li>
        <li>resell, scrape or systematically extract the service or its content without written permission;</li>
        <li>use the service to harass, threaten or discriminate against any person.</li>
      </ul>
      <p>
        We may suspend or terminate access where these rules are breached or where required by law.
      </p>

      <h2 id="ai">AI and third-party providers</h2>
      <p>
        AI-generated language can be incomplete, inaccurate or inconsistent. It is asked to use only validated
        inputs and to label uncertainty, but it remains interpretation, not fact. Model and prompt versions are
        recorded with each report.
      </p>
      <p>
        The operator may configure external AI, hosting, storage or email providers. Those providers process data
        under their own terms. The default local configuration uses a deterministic interpreter and does not send
        data to an external AI service.
      </p>

      <h2 id="payments">Payments</h2>
      <p>
        Payments are disabled in the default configuration. If the operator enables paid plans, prices and
        entitlements will be shown before purchase, payment will be verified server-side, and entitlements will be
        granted only after verified payment. Recurring charges require explicit consent. No card details are
        stored by AIBABA.
      </p>

      <h2 id="ip">Intellectual property</h2>
      <p>
        The AIBABA name, interface, software and report design are owned by the operator or its licensors. You
        receive a personal, non-transferable licence to use the service and to keep a copy of your own report for
        personal use. You retain ownership of the photographs and personal information you submit, and you grant
        the operator the limited licence needed to process them for the service you requested.
      </p>
      <p>
        You may share a report only through the permission-controlled share link, and only with people you choose.
        Do not publish another person&apos;s report without their consent.
      </p>

      <h2 id="availability">Availability</h2>
      <p>
        The service is provided on an &ldquo;as available&rdquo; basis. Maintenance, provider outages, invalid
        inputs or failed calculations may interrupt processing. Jobs may be retried, but no specific completion
        time is guaranteed. Reports remain available while your account and the applicable retention policy allow.
      </p>

      <h2 id="liability">Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, the operator is not liable for indirect, incidental or
        consequential loss arising from use of the service, reliance on a traditional interpretation, or a
        decision made on the basis of a report. Nothing in these terms excludes liability that cannot lawfully be
        excluded, including liability for fraud or death or personal injury caused by negligence.
      </p>
      <p>
        Where liability cannot be excluded, it is limited to the amount you paid for the affected reading in the
        twelve months before the claim, or the minimum permitted by law.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        You may stop using the service and delete your account at any time. The operator may suspend or terminate
        access for breach of these terms, security risk or legal requirement. Provisions that by their nature
        should survive termination — including intellectual property, disclaimers and liability — continue to
        apply.
      </p>

      <h2 id="changes">Changes and contact</h2>
      <p>
        These terms may be updated as the product or applicable law changes. The &ldquo;last updated&rdquo; date
        will change, and material changes will be communicated in the application where appropriate. Continued
        use after a change means you accept the updated terms.
      </p>
      <p>
        Questions about these terms: <strong>support@aibaba.app</strong>. Replace this address with the
        operator&apos;s monitored contact details before production launch. Governing law and venue should be
        specified by the operator for the relevant jurisdiction.
      </p>
    </DocumentShell>
  );
}
