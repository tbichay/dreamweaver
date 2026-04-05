"use client";

import { usePathname } from "next/navigation";
import { ProfileProvider } from "@/lib/profile-context";
import NavBar from "./NavBar";
import Sidebar from "./Sidebar";
import TosAcceptance from "./TosAcceptance";

// Routes without app chrome (no nav, no sidebar)
const NO_NAV_ROUTES = ["/", "/sign-in", "/sign-up", "/impressum", "/datenschutz", "/agb", "/barrierefreiheit"];

// Share pages have their own layout (no sidebar, no bottom nav)
function isShareRoute(pathname: string | null): boolean {
  return !!pathname?.startsWith("/share/");
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAppChrome = !NO_NAV_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(route + "/")
  ) && !isShareRoute(pathname);

  if (!showAppChrome) {
    return (
      <ProfileProvider>
        <TosAcceptance />
        {children}
      </ProfileProvider>
    );
  }

  return (
    <ProfileProvider>
      <TosAcceptance />
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <Sidebar />
        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <NavBar />
          {children}
        </div>
      </div>
    </ProfileProvider>
  );
}
