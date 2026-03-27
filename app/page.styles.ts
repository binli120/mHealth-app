/**
 * CSS keyframe animations and utility classes injected into the landing page
 * via a <style> tag so Tailwind's JIT doesn't need to know about them at build time.
 * @author Bin Lee
 */

export const LANDING_STYLES = `
  @keyframes float {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-12px); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .float-1 { animation: float 4s ease-in-out infinite; }
  .float-2 { animation: float 5s ease-in-out 0.8s infinite; }
  .float-3 { animation: float 3.5s ease-in-out 1.5s infinite; }
  .shimmer-text {
    background: linear-gradient(90deg, oklch(0.45 0.15 260) 0%, oklch(0.65 0.2 220) 50%, oklch(0.45 0.15 260) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 3s linear infinite;
  }
`
