import { SignUp } from "@clerk/nextjs";
import Stars from "../../components/Stars";

export default function SignUpPage() {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12">
      <Stars />
      <div className="relative z-10 text-center mb-8">
        <div className="text-5xl mb-3">🐨</div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-200 via-green-200 to-amber-200 bg-clip-text text-transparent">
          KoalaTree
        </h1>
        <p className="text-white/60">Erstelle ein Konto für magische Geschichten</p>
      </div>
      <div className="relative z-10">
        <SignUp />
      </div>
    </main>
  );
}
