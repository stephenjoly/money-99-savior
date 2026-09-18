// client/src/components/Navbar.tsx
import React from "react";
import type { Route } from "../routes";

interface NavbarProps {
  route: Route;
  onNavigate: (route: Route) => void;
}

const LINKS: { route: Route; label: string }[] = [
  { route: "/", label: "Clean a file" },
  { route: "/rules", label: "Correction rules" },
];

const Navbar: React.FC<NavbarProps> = ({ route, onNavigate }) => (
  <header className="bg-white border-b border-gray-200">
    <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("/");
        }}
        className="flex items-center gap-2.5 shrink-0"
      >
        <span className="w-6 h-6 rounded bg-gray-900 text-white grid place-items-center text-[10px] font-bold">
          99
        </span>
        <span className="font-semibold text-[15px] tracking-tight">
          Money 99 Savior
        </span>
      </a>

      <nav className="flex items-center gap-1 text-[13px]">
        {LINKS.map((link) => {
          const active = route === link.route;
          return (
            <a
              key={link.route}
              href={link.route}
              aria-current={active ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(link.route);
              }}
              className={
                active
                  ? "px-3 py-1.5 rounded-md font-medium bg-gray-100 text-gray-900"
                  : "px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-900"
              }
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </div>
  </header>
);

export default Navbar;
