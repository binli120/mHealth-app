import { flyerCopy } from "@/lib/flyer-copy";

export function FlyerFooter() {
  const { disclaimer } = flyerCopy;

  return (
    <div className="bg-[#123f42] px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="text-[12px] leading-relaxed text-white/70 sm:max-w-[640px]">
          {disclaimer.body} <span className="font-semibold text-white/90">{disclaimer.highlight}</span>{" "}
          {disclaimer.copyright}
        </p>

        <p className="text-[12px] text-white/70 sm:text-right sm:whitespace-nowrap">
          Questions?{" "}
          <a href={`mailto:${disclaimer.email}`} className="text-white underline underline-offset-2">
            {disclaimer.email}
          </a>
          <br />
          Call us:{" "}
          <a href={disclaimer.phoneHref} className="text-white underline underline-offset-2">
            {disclaimer.phoneLabel}
          </a>
        </p>
      </div>
    </div>
  );
}
