"use client";

export default function PageTransition({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`page-enter ${className}`}>
      {children}
    </div>
  );
}
