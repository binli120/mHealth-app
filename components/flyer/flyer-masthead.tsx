import { Compass } from "lucide-react";

import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerMasthead() {
  const { masthead } = flyerCopy;

  return (
    <div className="bg-[#1c6b6e] px-5 py-6 sm:px-8 sm:py-7 lg:px-12">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e8b054] sm:size-12">
            <Compass className="size-6 text-[#1c6b6e]" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[20px] leading-tight font-bold text-white sm:text-[24px]">{masthead.name}</h1>
            <p className="text-[12.5px] text-white/80 sm:text-[13.5px]">{masthead.tagline}</p>
          </div>
        </div>

        <span className="rounded-full border border-white/40 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-white uppercase sm:text-[12px]">
          {masthead.badge}
        </span>
      </div>
    </div>
  );
}
