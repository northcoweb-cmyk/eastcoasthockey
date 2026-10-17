import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  ["About", "#about"],
  ["Menu", "#order"],
  ["Reviews", "#reviews"],
  ["Hours", "#visit"],
];

export function Nav() {
  const { count, setOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-black/10 bg-white/90 backdrop-blur-xl" : "bg-white/0"
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-10">
        <a href="#top" aria-label="Village Grille home" className="flex items-center">
          <img src="/logo.png" alt="Village Grille" className="h-[72px] w-[72px] object-contain" />
        </a>
        <nav className="flex items-center gap-1 md:gap-2">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="hidden px-3 text-sm font-medium text-zinc-700 transition hover:text-brand md:block">
              {l}
            </a>
          ))}
          <Button size="sm" onClick={() => setOpen(true)} aria-label={`Open cart, ${count} items`}>
            <ShoppingBag className="h-4 w-4" />
            Cart
            {count > 0 && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-xs font-bold text-brand">
                {count}
              </span>
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}
