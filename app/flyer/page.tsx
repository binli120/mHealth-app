import type { Metadata } from "next";

import { FlyerMasthead } from "@/components/flyer/flyer-masthead";
import { FlyerHero } from "@/components/flyer/flyer-hero";
import { FlyerPrograms } from "@/components/flyer/flyer-programs";
import { FlyerFeatures } from "@/components/flyer/flyer-features";
import { FlyerEligibility } from "@/components/flyer/flyer-eligibility";
import { FlyerCta } from "@/components/flyer/flyer-cta";
import { FlyerFooter } from "@/components/flyer/flyer-footer";

export const metadata: Metadata = {
  title: "HealthCompass MA Flyer — Comura",
  description:
    "HealthCompass MA checks 10+ Massachusetts benefit programs at once — MassHealth, SNAP, EITC, LIHEAP, WIC, and more — and walks you through applying, step by step.",
};

export default function FlyerPage() {
  return (
    <main>
      <FlyerMasthead />
      <FlyerHero />
      <FlyerPrograms />
      <FlyerFeatures />
      <FlyerEligibility />
      <FlyerCta />
      <FlyerFooter />
    </main>
  );
}
