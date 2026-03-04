import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { CallStateWrapper } from "@/components/calls/CallStateWrapper";
import { SosAlertListener } from "@/components/stress/SosAlertListener";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <CallStateWrapper>
      <SosAlertListener />
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl pb-20 md:pb-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </CallStateWrapper>
  );
}
