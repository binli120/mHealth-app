import { Check } from "lucide-react";

import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerPrograms() {
  const { programs } = flyerCopy;

  return (
    <div className="bg-[#fdf3e4] px-5 pb-10 sm:px-8 sm:pb-12 lg:px-12 lg:pb-14">
      <div className="mx-auto max-w-[1100px] rounded-xl bg-[#d3e9ec] px-6 py-7 sm:px-9 sm:py-8">
        <h3 className="mb-5 text-[17px] font-bold text-[#1c6b6e] sm:text-[19px]">{programs.heading}</h3>

        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          {programs.items.map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2f9e5b]">
                <Check className="size-3 text-white" strokeWidth={3} />
              </span>
              <span className="text-[13.5px] font-medium text-[#2b3a3a]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
