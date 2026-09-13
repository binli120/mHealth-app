import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerEligibility() {
  const { eligibility } = flyerCopy;

  return (
    <div className="bg-white px-5 pb-10 sm:px-8 sm:pb-12 lg:px-12 lg:pb-14">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 rounded-xl bg-[#f6e8c8] p-6 sm:flex-row sm:items-center sm:p-7">
        <span className="w-fit shrink-0 rounded-full bg-[#e8b054] px-4 py-2 text-[13px] font-bold text-[#4a3410] sm:max-w-[160px]">
          {eligibility.badge}
        </span>

        <div>
          <p className="text-[14px] leading-relaxed text-[#3a3430]">{eligibility.body}</p>
          <p className="mt-1.5 text-[13px] font-medium text-[#1c6b6e]">{eligibility.languages}</p>
        </div>
      </div>
    </div>
  );
}
