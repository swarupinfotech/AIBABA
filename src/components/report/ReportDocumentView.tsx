import type { ReportBlock, ReportDocument, ReportSection } from "@/services/ai/schemas";
import { KundliChart } from "@/components/astrology/KundliChart";
import type { KundliCharts } from "@/components/astrology/chart-data";

export function ReportDocumentView({
  document,
  chart,
}: {
  document: ReportDocument;
  chart?: KundliCharts | null;
}) {
  return (
    <div>
      <div className="report-methods grid gap-3 sm:grid-cols-3">
        {document.methods.map((method) => (
          <div key={method.module} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#8a86a0]">{method.module}</p>
              <span
                className={`badge ${
                  method.status === "COMPLETED"
                    ? "badge-success"
                    : method.status === "LIMITED"
                      ? "badge-warn"
                      : method.status === "UNAVAILABLE"
                        ? "badge-danger"
                        : "badge-muted"
                }`}
              >
                {method.status}
              </span>
            </div>
            <p className="mt-2 text-[0.76rem] font-medium text-[#2f2c47]">{method.method}</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-[#8a86a0]">{method.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-12">
        {document.sections.map((section, index) => (
          <ReportSectionView key={section.id || index} section={section} index={index} chart={chart} />
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-[#e8dfc9] bg-[#fbf9f4] p-6">
        <h2 className="font-serif text-2xl text-[#10152b]">Important disclosures</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Disclosure title="Traditional interpretation" text={document.disclosures.traditional} />
          <Disclosure title="AI-assisted language" text={document.disclosures.ai} />
          <Disclosure title="Uncertainty" text={document.disclosures.uncertainty} />
          <Disclosure title="Not predictive" text={document.disclosures.notPredictive} />
        </div>
      </section>
    </div>
  );
}

function Disclosure({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/60 p-4">
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#8a6a2d]">{title}</p>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-[#5b5775]">{text}</p>
    </div>
  );
}

function ReportSectionView({
  section,
  index,
  chart,
}: {
  section: ReportSection;
  index: number;
  chart?: KundliCharts | null;
}) {
  return (
    <section id={`section-${section.id || index}`} className="scroll-mt-24">
      <div className="border-l-2 border-[#d6ae63] pl-4">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#6746c8]">
          {String(index + 1).padStart(2, "0")} · {section.kind.replace(/_/g, " ")}
        </p>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-[#10152b]">{section.title}</h2>
      </div>
      <div className="report-prose mt-4">
        <p className="text-[1.02rem] text-[#3e3b55]">{section.intro}</p>
        {section.kind === "VEDIC" && chart ? <KundliChart charts={chart} /> : null}
        {section.blocks.map((block, blockIndex) => (
          <BlockView key={blockIndex} block={block} />
        ))}
      </div>
    </section>
  );
}

function BlockView({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p>{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    case "numberCards":
      return (
        <div className="my-5 grid gap-3 sm:grid-cols-2">
          {block.numbers.map((number, index) => (
            <div key={index} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-4xl leading-none text-[#6746c8]">{number.value}</span>
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#8a86a0]">{number.label}</p>
                  <p className="text-[0.82rem] font-semibold text-[#2f2c47]">{number.title}</p>
                </div>
              </div>
              <p className="mt-3 text-[0.82rem] leading-relaxed text-[#4e4a68]">{number.detail}</p>
              <p className="mt-2 text-[0.68rem] italic text-[#8a86a0]">{number.method}</p>
            </div>
          ))}
        </div>
      );
    case "featureCards":
      return (
        <div className="my-5 grid gap-3 sm:grid-cols-2">
          {block.features.map((feature, index) => (
            <div key={index} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.85rem] font-semibold text-[#2f2c47]">{feature.name}</p>
                <span className={`badge ${feature.status === "VISIBLE" ? "badge-success" : "badge-warn"}`}>
                  {feature.status} · {Math.round(feature.confidence * 100)}%
                </span>
              </div>
              <p className="mt-2 text-[0.78rem] leading-relaxed text-[#4e4a68]">
                <span className="font-semibold text-[#2f2c47]">Observation.</span> {feature.observation}
              </p>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-[#4e4a68]">
                <span className="font-semibold text-[#2f2c47]">Interpretation.</span> {feature.interpretation}
              </p>
              <p className="mt-1.5 text-[0.68rem] italic text-[#8a86a0]">{feature.uncertainty}</p>
            </div>
          ))}
        </div>
      );
    case "planetTable":
      return (
        <div className="my-4 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Planet</th>
                <th>Sign</th>
                <th>Degree</th>
                <th>Nakshatra</th>
                <th>Pada</th>
                <th>House</th>
                <th>Retro</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, index) => (
                <tr key={index}>
                  <td className="font-medium text-[#2f2c47]">{row.name}</td>
                  <td>{row.sign}</td>
                  <td>{row.degree.toFixed(2)}°</td>
                  <td>{row.nakshatra}</td>
                  <td>{row.pada}</td>
                  <td>{row.house ?? "—"}</td>
                  <td>{row.retrograde ? "R" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[0.7rem] italic text-[#8a86a0]">{block.note}</p>
        </div>
      );
    case "dashaTimeline":
      return (
        <div className="my-4 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Lord</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Years</th>
              </tr>
            </thead>
            <tbody>
              {block.periods.map((period, index) => (
                <tr key={index}>
                  <td className="font-medium text-[#2f2c47]">
                    {period.lord}
                    {period.isBalanceAtBirth ? " (balance at birth)" : ""}
                  </td>
                  <td>{period.start}</td>
                  <td>{period.end}</td>
                  <td>{period.years}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[0.7rem] italic text-[#8a86a0]">{block.note}</p>
        </div>
      );
    case "callout":
      return (
        <div
          className={`my-5 rounded-xl border-l-2 p-4 ${
            block.tone === "caution"
              ? "border-[#b8862f] bg-[#fdf6e6]"
              : block.tone === "traditional"
                ? "border-[#d6ae63] bg-[#fbf9f4]"
                : "border-[#6746c8] bg-[rgba(103,70,200,.05)]"
          }`}
        >
          <p className="text-[0.82rem] font-semibold text-[#2f2c47]">{block.title}</p>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-[#4e4a68]">{block.text}</p>
        </div>
      );
    case "calculation":
      return (
        <div className="my-5 rounded-xl border border-[#e8dfc9] bg-[#fbf9f4] p-4">
          <p className="text-[0.82rem] font-semibold text-[#2f2c47]">{block.title}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.78rem] leading-relaxed text-[#4e4a68]">
            {block.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="mt-2 text-[0.68rem] italic text-[#8a86a0]">{block.note}</p>
        </div>
      );
    case "reflections":
      return (
        <div className="my-5 rounded-xl border border-[var(--line)] bg-white/60 p-4">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#6746c8]">Reflect</p>
          <ul className="mt-2">
            {block.prompts.map((prompt, index) => (
              <li key={index}>{prompt}</li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
}
