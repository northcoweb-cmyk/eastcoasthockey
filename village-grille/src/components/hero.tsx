import { ArrowDown, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { INFO, PHOTOS } from "@/data/menu";

const marquee = ["Deli Classics", "Diner Favorites", "Tex-Mex", "Burgers", "Subs", "Breakfast", "Pizza", "Wraps"];

export function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen flex-col justify-end overflow-hidden pt-24">
      <img
        src={PHOTOS.cali}
        alt="California club sandwich"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-[#050505]/20" />
      <div className="absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full bg-orange-600/20 blur-[140px]" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 md:px-10 md:pb-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-sm text-zinc-300 backdrop-blur">
          <MapPin className="h-4 w-4 text-orange-500" /> Rockville, MD
        </p>
        <h1 className="font-display text-[clamp(3.5rem,13vw,11rem)] font-extrabold uppercase leading-[0.82] tracking-tighter">
          Seriously
          <br />
          <span className="text-orange-500">good</span> food.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-zinc-300 md:text-xl">
          Stacked deli sandwiches, juicy burgers and bold Tex-Mex — all under one roof at {INFO.address.split(",")[0]}.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="#order" className={buttonVariants({ size: "lg" })}>
            Order online <ArrowDown className="h-5 w-5" />
          </a>
          <a href="#visit" className={buttonVariants({ size: "lg", variant: "outline" })}>
            Hours &amp; location
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden border-y border-white/10 bg-black/60 py-4 backdrop-blur">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap font-display text-2xl font-bold uppercase text-zinc-500">
          {[...marquee, ...marquee, ...marquee, ...marquee].map((m, i) => (
            <span key={i} className="flex items-center gap-12">
              {m} <span className="text-orange-500">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
