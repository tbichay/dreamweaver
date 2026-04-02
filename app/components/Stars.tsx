"use client";

export default function Stars() {
  // Fireflies — fewer, softer, slower
  const fireflies = [
    { top: "10%", left: "15%", size: 6, delay: 0 },
    { top: "18%", left: "75%", size: 8, delay: 2 },
    { top: "35%", left: "40%", size: 5, delay: 1.2 },
    { top: "25%", left: "88%", size: 7, delay: 3.5 },
    { top: "55%", left: "10%", size: 6, delay: 1.8 },
    { top: "70%", left: "65%", size: 5, delay: 2.8 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {fireflies.map((fly, i) => (
        <div
          key={i}
          className="firefly absolute rounded-full"
          style={{
            top: fly.top,
            left: fly.left,
            width: `${fly.size}px`,
            height: `${fly.size}px`,
            animationDelay: `${fly.delay}s`,
            animationDuration: `${5 + (i % 3) * 2}s`,
          }}
        />
      ))}
    </div>
  );
}
