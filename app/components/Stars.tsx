"use client";

export default function Stars() {
  // Fireflies — warm amber glowing dots
  const fireflies = [
    { top: "8%", left: "12%", size: 3, delay: 0 },
    { top: "15%", left: "82%", size: 4, delay: 1.5 },
    { top: "22%", left: "40%", size: 3, delay: 0.8 },
    { top: "10%", left: "60%", size: 2.5, delay: 2.2 },
    { top: "35%", left: "18%", size: 3.5, delay: 1 },
    { top: "18%", left: "28%", size: 2.5, delay: 1.8 },
    { top: "28%", left: "72%", size: 3, delay: 2.8 },
    { top: "40%", left: "88%", size: 2.5, delay: 0.5 },
    { top: "50%", left: "8%", size: 3, delay: 2 },
    { top: "60%", left: "55%", size: 2.5, delay: 1.3 },
    { top: "70%", left: "78%", size: 3, delay: 0.3 },
    { top: "80%", left: "20%", size: 3.5, delay: 1.6 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {fireflies.map((fly, i) => (
        <div
          key={i}
          className="star absolute rounded-full"
          style={{
            top: fly.top,
            left: fly.left,
            width: `${fly.size}px`,
            height: `${fly.size}px`,
            animationDelay: `${fly.delay}s`,
            animationDuration: `${3 + (i % 3)}s`,
          }}
        />
      ))}
      {/* Tree silhouette hint */}
      <div
        className="absolute float opacity-20"
        style={{ bottom: "5%", right: "5%", fontSize: "4rem" }}
      >
        🌳
      </div>
    </div>
  );
}
