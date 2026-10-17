import { CartProvider } from "@/lib/cart";
import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { About } from "@/components/about";
import { Specialties } from "@/components/specialties";
import { OrderMenu } from "@/components/order-menu";
import { CartDrawer } from "@/components/cart-drawer";
import { Visit } from "@/components/visit";

export default function App() {
  return (
    <CartProvider>
      <Nav />
      <main>
        <Hero />
        <About />
        <Specialties />
        <OrderMenu />
        <Visit />
      </main>
      <CartDrawer />
    </CartProvider>
  );
}
