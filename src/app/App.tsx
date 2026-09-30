import { Navigate, Route, Routes } from "react-router-dom";
import { CalcCheckPage } from "@/pages/CalcCheckPage";
import { AdminPage } from "@/pages/AdminPage";
import { DivisionTimesheetPage } from "@/pages/DivisionTimesheetPage";
import { MyOperationsPage } from "@/pages/MyOperationsPage";
import { PaySchemesPage } from "@/pages/PaySchemesPage";
import { PayoutDetailPage } from "@/pages/PayoutDetailPage";
import { PeriodApprovalPage } from "@/pages/PeriodApprovalPage";
import { SopRegistryPage } from "@/pages/SopRegistryPage";
import { TariffDetailPage } from "@/pages/TariffDetailPage";
import { TariffsPage } from "@/pages/TariffsPage";
import { TimesheetCalendarPage } from "@/pages/TimesheetCalendarPage";
import { WorkPlansPage } from "@/pages/WorkPlansPage";
import { AppShell } from "./AppShell";
import { StoreProvider } from "./store/StoreProvider";

export function App() {
  return (
    <StoreProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/sops" replace />} />
          <Route path="/sops" element={<SopRegistryPage />} />
          <Route path="/sops/:sopId" element={<SopRegistryPage />} />
          <Route path="/tariffs" element={<TariffsPage />} />
          <Route path="/tariffs/:tariffId" element={<TariffDetailPage />} />
          <Route path="/pay-schemes" element={<PaySchemesPage />} />
          <Route path="/my-operations" element={<MyOperationsPage />} />
          <Route path="/work-plans" element={<WorkPlansPage />} />
          <Route path="/timesheet" element={<DivisionTimesheetPage />} />
          <Route path="/timesheet-calendar" element={<TimesheetCalendarPage />} />
          <Route path="/period-approval" element={<PeriodApprovalPage />} />
          <Route path="/payout/:personId" element={<PayoutDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/calc-check" element={<CalcCheckPage />} />
          <Route path="*" element={<Navigate to="/sops" replace />} />
        </Routes>
      </AppShell>
    </StoreProvider>
  );
}
