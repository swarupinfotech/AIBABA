"use client";

import { useState } from "react";
import {
  RASHI_NAMES,
  deriveHouse,
  type KundliCharts,
  type KundliPlanet,
} from "@/components/astrology/chart-data";

const RASHI_ABBR = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];

const PLANET_ABBR: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

const NORTH_POSITIONS: Record<number, [number, number]> = {
  1: [50, 15],
  2: [24, 8],
  3: [8, 24],
  4: [8, 50],
  5: [8, 76],
  6: [24, 92],
  7: [50, 85],
  8: [76, 92],
  9: [92, 76],
  10: [92, 50],
  11: [92, 24],
  12: [76, 8],
};

const SOUTH_LAYOUT = [11, 0, 1, 2, 10, -1, -1, 3, 9, -1, -1, 4, 8, 7, 6, 5];

export function KundliChart({ charts }: { charts: KundliCharts }) {
  const [style, setStyle] = useState<"north" | "south">("north");
  const [division, setDivision] = useState<"d1" | "d9">("d1");

  const active = division === "d9" ? charts.d9 : charts.d1;
  const asc = active?.ascendantSignIndex ?? charts.d1.ascendantSignIndex;
  const planets = active?.planets ?? [];

  const byHouse = new Map<number, KundliPlanet[]>();
  const bySign = new Map<number, KundliPlanet[]>();
  for (const planet of planets) {
    const house = deriveHouse(planet, asc);
    byHouse.set(house, [...(byHouse.get(house) ?? []), planet]);
    bySign.set(planet.signIndex, [...(bySign.get(planet.signIndex) ?? []), planet]);
  }

  return (
    <figure className="my-6 rounded-2xl border border-[var(--line)] bg-white/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#6746c8]">
            Calculated chart · {division === "d1" ? "D1 rashi" : "D9 navamsa"}
          </p>
          <p className="mt-1 text-[0.78rem] font-semibold text-[#2f2c47]">
            {RASHI_NAMES[asc]} ascendant · whole-sign houses
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="flex overflow-hidden rounded-full border border-[var(--line-strong)]">
            {(["north", "south"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStyle(option)}
                aria-pressed={style === option}
                className={`px-2.5 py-1 text-[0.66rem] font-semibold capitalize transition-colors ${
                  style === option ? "bg-[#6746c8] text-white" : "bg-white/70 text-[#4b4866] hover:bg-[#f2eefb]"
                }`}
              >
                {option} Indian
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-full border border-[var(--line-strong)]">
            {(["d1", "d9"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDivision(option)}
                disabled={option === "d9" && !charts.d9}
                aria-pressed={division === option}
                className={`px-2.5 py-1 text-[0.66rem] font-semibold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  division === option ? "bg-[#22205a] text-white" : "bg-white/70 text-[#4b4866] hover:bg-[#f2eefb]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-[460px]">
        {style === "north" ? (
          <div className="relative aspect-square w-full">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#d8d2e8" strokeWidth="0.7" />
              <line x1="0.5" y1="0.5" x2="99.5" y2="99.5" stroke="#d8d2e8" strokeWidth="0.7" />
              <line x1="99.5" y1="0.5" x2="0.5" y2="99.5" stroke="#d8d2e8" strokeWidth="0.7" />
              <polygon
                points="50,0.5 99.5,50 50,99.5 0.5,50"
                fill="none"
                stroke="#d8d2e8"
                strokeWidth="0.7"
              />
            </svg>
            {Object.entries(NORTH_POSITIONS).map(([house, [left, top]]) => {
              const houseNumber = Number(house);
              const placed = byHouse.get(houseNumber) ?? [];
              return (
                <div
                  key={house}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center"
                  style={{ left: `${left}%`, top: `${top}%`, width: "22%" }}
                >
                  <span className="text-[0.55rem] font-bold text-[#b0a8c8]">{houseNumber}</span>
                  <div className="flex flex-wrap justify-center gap-0.5">
                    {placed.map((planet) => (
                      <PlanetChip key={`${planet.name}-${planet.signIndex}`} planet={planet} />
                    ))}
                  </div>
                  <span className="text-[0.5rem] text-[#9b95b0]">{RASHI_ABBR[(asc + houseNumber - 1) % 12]}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid aspect-square w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-lg border border-[#d8d2e8]">
            {SOUTH_LAYOUT.map((signIndex, index) => {
              if (signIndex === -1) {
                if (index === 5) {
                  return (
                    <div
                      key={`centre-${index}`}
                      className="col-span-2 row-span-2 grid place-items-center bg-[#faf8fd] text-center"
                    >
                      <div>
                        <p className="font-serif text-2xl text-[#6746c8]">{division.toUpperCase()}</p>
                        <p className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] text-[#8a86a0]">
                          Sidereal · Lahiri
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }
              const placed = bySign.get(signIndex) ?? [];
              const isAsc = signIndex === asc;
              return (
                <div
                  key={signIndex}
                  className={`flex min-h-0 flex-col border border-[#e6e1f0] p-1 ${
                    isAsc ? "bg-[#f4efff]" : "bg-white/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[0.55rem] font-bold uppercase tracking-wide text-[#8a86a0]">
                      {RASHI_ABBR[signIndex]}
                    </span>
                    {isAsc ? (
                      <span className="rounded-sm bg-[#d6ae63] px-1 text-[0.5rem] font-bold text-[#10152b]">
                        Asc
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-wrap items-end gap-0.5">
                    {placed.map((planet) => (
                      <PlanetChip key={`${planet.name}-${planet.signIndex}`} planet={planet} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <figcaption className="mt-3 text-[0.66rem] leading-relaxed text-[#8a86a0]">
        Positions are computed by the configured sidereal engine (Lahiri ayanamsa, mean node) and stored with
        the reading. The chart is a drawing of those calculations, not an interpretation. D9 navamsa is
        derived from the same longitudes; other divisional charts are not calculated.
      </figcaption>
    </figure>
  );
}

function PlanetChip({ planet }: { planet: KundliPlanet }) {
  return (
    <span
      className="rounded bg-[#f2eefb] px-1 py-[1px] text-[0.55rem] font-semibold leading-tight text-[#3b2f6b]"
      title={`${planet.name}${planet.retrograde ? " (retrograde)" : ""} · ${RASHI_NAMES[planet.signIndex]}`}
    >
      {PLANET_ABBR[planet.name] ?? planet.name.slice(0, 2)}
      {planet.retrograde ? <span className="text-[#8a6a2d]">℞</span> : null}
    </span>
  );
}
