import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  ["Menu", "#order"],
  ["Visit", "#visit"],
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
        scrolled ? "bg-black/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
        <a href="#top" className="font-display text-xl font-extrabold tracking-tight">
          Village<span className="text-orange-500"> Grille</span>
        </a>
        <nav className="flex items-center gap-1 md:gap-3">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="hidden px-3 text-sm text-zinc-300 transition hover:text-white sm:block">
              {l}
            </a>
          ))}
          <Button size="sm" onClick={() => setOpen(true)} aria-label={`Open cart, ${count} items`}>
            <ShoppingBag className="h-4 w-4" />
            Cart
            {count > 0 && (
              <span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-black px-1 text-xs text-orange-400">
                {count}
              </span>
            )}
          </Button>
        </nav>
      </div>
    </header>
  );
}
