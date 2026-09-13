import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerFeatures() {
  const { features } = flyerCopy;

  return (
    <div className="bg-white px-5 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#6a3fa0] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
            {features.eyebrow}
          </span>
          <h3 className="text-[19px] font-bold text-[#2b2540] sm:text-[22px]">{features.heading}</h3>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.items.map((item) => (
            <div key={item.title}>
              <h4 className="mb-1.5 text-[15px] font-bold text-[#6a3fa0]">{item.title}</h4>
              <p className="text-[13.5px] leading-relaxed text-[#5a544c]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
