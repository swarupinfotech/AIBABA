import Link from "next/link";

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="AIBABA home">
      <span
        className="grid h-9 w-9 place-items-center rounded-full border"
        style={{
          borderColor: light ? "rgba(214,174,99,.5)" : "rgba(34,32,90,.18)",
          background: light
            ? "linear-gradient(145deg, rgba(214,174,99,.2), rgba(103,70,200,.28))"
            : "linear-gradient(145deg, #22205a, #10152b)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16.8 3.2a9 9 0 1 0 4 12.4A9.4 9.4 0 0 1 16.8 3.2Z"
            stroke={light ? "#D6AE63" : "#E8CD98"}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="18.4" cy="5.6" r="1.15" fill="#D6AE63" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className="text-[0.95rem] font-bold tracking-[0.28em]"
          style={{ color: light ? "#FAF7F0" : "#10152B" }}
        >
          AIBABA
        </span>
        {!compact && (
          <span
            className="mt-1 text-[0.53rem] font-semibold uppercase tracking-[0.24em]"
            style={{ color: light ? "rgba(250,247,240,.55)" : "#8A86A0" }}
          >
            Complete Life Reading
          </span>
        )}
      </span>
    </Link>
  );
}
