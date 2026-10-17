import { Clock, MapPin, Phone, Star } from "lucide-react";
import { INFO, REVIEWS } from "@/data/menu";

export function Visit() {
  const today = (new Date().getDay() + 6) % 7; // Monday = 0
  return (
    <section id="visit" className="border-t border-white/10 bg-gradient-to-b from-transparent to-orange-950/20">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-orange-500">Come hungry</p>
            <h2 className="font-display text-5xl font-extrabold uppercase leading-[0.9] tracking-tighter md:text-7xl">
              Visit us
            </h2>
            <ul className="mt-10 space-y-5 text-lg">
              <li className="flex gap-4">
                <MapPin className="mt-1 h-5 w-5 flex-none text-orange-500" />
                <a href={INFO.mapsUrl} target="_blank" rel="noreferrer" className="hover:text-orange-400">
                  {INFO.address}
                </a>
              </li>
              <li className="flex gap-4">
                <Phone className="mt-1 h-5 w-5 flex-none text-orange-500" />
                <a href={INFO.phoneHref} className="hover:text-orange-400">{INFO.phone}</a>
              </li>
            </ul>
            <div className="mt-12 space-y-4">
              {REVIEWS.map((r) => (
                <figure key={r.who} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-3 flex gap-0.5 text-orange-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-zinc-300">“{r.text}”</blockquote>
                  <figcaption className="mt-3 text-sm text-zinc-500">— {r.who}</figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <h3 className="mb-6 flex items-center gap-3 font-display text-2xl font-bold">
                <Clock className="h-5 w-5 text-orange-500" /> Hours
              </h3>
              <ul className="divide-y divide-white/10">
                {INFO.hours.map(([day, hrs], i) => (
                  <li key={day} className={`flex justify-between py-3 ${i === today ? "font-semibold text-orange-400" : "text-zinc-300"}`}>
                    <span>{day}{i === today && " · today"}</span>
                    <span>{hrs}</span>
                  </li>
                ))}
              </ul>
            </div>
            <iframe
              title="Map to Village Grille"
              loading="lazy"
              className="mt-6 h-72 w-full rounded-3xl border border-white/10 grayscale invert-[0.92] contrast-90"
              src={`https://www.google.com/maps?q=${encodeURIComponent(INFO.address)}&output=embed`}
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 px-5 py-8 text-sm text-zinc-500 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <p>© {new Date().getFullYear()} Village Grille · Rockville, MD</p>
          <div className="flex gap-5">
            {Object.entries(INFO.social).map(([n, h]) => (
              <a key={n} href={h} target="_blank" rel="noreferrer" className="hover:text-white">{n}</a>
            ))}
          </div>
        </div>
      </footer>
    </section>
  );
}
