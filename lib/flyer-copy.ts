export interface FlyerCopy {
  masthead: {
    name: string;
    tagline: string;
    badge: string;
  };
  hero: {
    headingLine1: string;
    headingLine2: string;
    subtitle: string;
  };
  steps: {
    icon: "search" | "file" | "heart";
    title: string;
    body: string;
  }[];
  programs: {
    heading: string;
    items: string[];
  };
  features: {
    eyebrow: string;
    heading: string;
    items: { title: string; body: string }[];
  };
  eligibility: {
    badge: string;
    body: string;
    languages: string;
  };
  cta: {
    heading: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    phoneLabel: string;
    phoneHref: string;
  };
  trust: string[];
  disclaimer: {
    body: string;
    highlight: string;
    copyright: string;
    email: string;
    phoneLabel: string;
    phoneHref: string;
  };
}

export const flyerCopy: FlyerCopy = {
  masthead: {
    name: "HealthCompass MA",
    tagline: "AI-powered benefit navigation for Massachusetts",
    badge: "For Massachusetts residents",
  },
  hero: {
    headingLine1: "Find every benefit",
    headingLine2: "you deserve.",
    subtitle:
      "Massachusetts families miss up to $4,800 a year in benefits they already qualify for. HealthCompass MA checks 10+ programs at once — MassHealth, SNAP, EITC, LIHEAP, WIC, and more — and walks you through applying, step by step. Free. Private. In your language.",
  },
  steps: [
    {
      icon: "search",
      title: "1. Quick Check",
      body: "Answer a few simple questions about your household. Our AI checks your eligibility across 10+ programs in minutes.",
    },
    {
      icon: "file",
      title: "2. Guided Application",
      body: "We walk you through each application with plain-language explanations and a clear document checklist.",
    },
    {
      icon: "heart",
      title: "3. Real Human Help",
      body: "Connect with a licensed assisting counselor by chat, voice message, or screen sharing — in your language.",
    },
  ],
  programs: {
    heading: "We help you check 10+ programs at once",
    items: [
      "MassHealth",
      "SNAP food assistance",
      "Health Safety Net",
      "Cash aid (TAFDC, EAEDC)",
      "LIHEAP home energy aid",
      "WIC for parents & kids",
      "EITC & other tax credits",
      "Medicare Savings Programs",
      "Child care & housing help",
    ],
  },
  features: {
    eyebrow: "Key features",
    heading: "What makes HealthCompass MA different",
    items: [
      {
        title: "Cross-Program Screening",
        body: "Check MassHealth and 10+ safety-net programs from one household profile, with estimated benefits and next steps.",
      },
      {
        title: "Guided, Autosaved Applications",
        body: "Complete MassHealth forms with plain-language guidance, conditional steps and resumable drafts.",
      },
      {
        title: "Documents & Identity",
        body: "Get tailored proof checklists, secure uploads and identity verification by license barcode or staff review.",
      },
      {
        title: "Tracking & Appeal Support",
        body: "Follow case status and information requests, then turn a denial into policy-grounded appeal guidance.",
      },
      {
        title: "Social-Worker Collaboration",
        body: "Share cases by consent, exchange secure messages and translated voice notes, or start guided co-browsing.",
      },
      {
        title: "Reviewer & Admin Workflows",
        body: "Use role-based queues for reviews and decisions, company and assister approvals, and complete audit trails.",
      },
    ],
  },
  eligibility: {
    badge: "Who can use HealthCompass MA?",
    body: "Open to Massachusetts residents. Adults 18 and older can apply for themselves — or on behalf of a child, parent, or family member who can't apply on their own.",
    languages: "Available in: English · Español · Português · 简体中文 · Kreyòl ayisyen · Tiếng Việt",
  },
  cta: {
    heading: "Ready to find your benefits?",
    body: "Start your free check today — takes about 15 minutes, and your information stays private.",
    primaryLabel: "healthcompass.cloud",
    primaryHref: "https://healthcompass.cloud",
    phoneLabel: "Call 1-617-300-7750",
    phoneHref: "tel:+16173007750",
  },
  trust: [
    "Free to use",
    "HIPAA-aligned",
    "201 CMR 17.00",
    "Encrypted in transit & at rest",
    "Delete your data anytime",
  ],
  disclaimer: {
    body: "HealthCompass MA is an independent service that helps Massachusetts residents discover and apply for the benefits they've earned. We are not affiliated with the Commonwealth of Massachusetts or MassHealth, and we provide application assistance — not legal advice.",
    highlight: "We never sell your information.",
    copyright: "© 2026 HealthCompass MA.",
    email: "hello@healthcompass.cloud",
    phoneLabel: "1-617-300-7750",
    phoneHref: "tel:+16173007750",
  },
};
