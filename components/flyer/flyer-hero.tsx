import { Search, FileText, Heart, type LucideIcon } from "lucide-react";

import { flyerCopy } from "@/lib/flyer-copy";

const icons: Record<(typeof flyerCopy.steps)[number]["icon"], { Icon: LucideIcon; bg: string; fg: string }> = {
  search: { Icon: Search, bg: "#d7ecef", fg: "#1c6b6e" },
  file: { Icon: FileText, bg: "#fbe1d3", fg: "#d9603f" },
  heart: { Icon: Heart, bg: "#faf0d0", fg: "#b6842f" },
};

export function FlyerHero() {
  const { hero, steps } = flyerCopy;

  return (
    <div className="bg-[#fdf3e4] px-5 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="text-[28px] leading-[1.15] font-bold text-[#1c6b6e] sm:text-[36px] lg:text-[42px]">
          {hero.headingLine1}
        </h2>
        <h2 className="mb-5 text-[28px] leading-[1.15] font-bold text-[#e2704f] sm:text-[36px] lg:text-[42px]">
          {hero.headingLine2}
        </h2>

        <p className="max-w-[880px] text-[15px] leading-relaxed text-[#3a3430] sm:text-[16px]">{hero.subtitle}</p>

        <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {steps.map((step) => {
            const { Icon, bg, fg } = icons[step.icon];
            return (
              <div key={step.title} className="rounded-xl border border-[#e7dcc7] bg-white p-5 shadow-sm">
                <div
                  className="mb-3.5 flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: bg }}
                >
                  <Icon className="size-5" style={{ color: fg }} strokeWidth={2} />
                </div>
                <h3 className="mb-1.5 text-[16px] font-bold text-[#1c6b6e]">{step.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-[#5a544c]">{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
