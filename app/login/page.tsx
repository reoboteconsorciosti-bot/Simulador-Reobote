import { LoginScreen } from "@/components/login-screen"

export default async function LoginPage() {
  return (
    <main className="relative min-h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -right-20 top-1/4 w-[1000px] h-[750px] opacity-[0.12]">
          <img
            src="/images/brand-arrow.png"
            alt=""
            className="w-full h-full object-contain blur-sm"
            style={{ filter: "hue-rotate(10deg) saturate(1.2)" }}
          />
        </div>
        <div className="absolute -left-10 bottom-10 w-[800px] h-[600px] opacity-[0.10] rotate-12">
          <img
            src="/images/brand-arrow.png"
            alt=""
            className="w-full h-full object-contain blur-sm"
            style={{ filter: "hue-rotate(10deg) saturate(1.2)" }}
          />
        </div>
      </div>
      <LoginScreen />
    </main>
  )
}
