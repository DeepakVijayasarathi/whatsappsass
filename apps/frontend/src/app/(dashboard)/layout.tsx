import DashboardShell from "@/components/DashboardShell";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <ErrorBoundary label="dashboard">
        {children}
      </ErrorBoundary>
    </DashboardShell>
  );
}
