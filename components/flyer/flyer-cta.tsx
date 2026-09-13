import { Check } from "lucide-react";

import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerCta() {
  const { cta, trust } = flyerCopy;

  return (
    <div className="bg-[#e2704f] px-5 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[520px]">
            <h3 className="mb-2 text-[22px] font-bold text-white sm:text-[26px]">{cta.heading}</h3>
            <p className="text-[14.5px] text-white/90">{cta.body}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={cta.primaryHref}
              target="_blank"
              rel="noopener"
              className="rounded-full bg-white px-6 py-3 text-[14px] font-bold text-[#1c6b6e] transition-opacity hover:opacity-90"
            >
              {cta.primaryLabel}
            </a>
            <a
              href={cta.phoneHref}
              className="rounded-full border-2 border-white px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-white/10"
            >
              {cta.phoneLabel}
            </a>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/25 pt-6">
          {trust.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check className="size-4 text-white" strokeWidth={2.5} />
              <span className="text-[13px] font-medium text-white">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
