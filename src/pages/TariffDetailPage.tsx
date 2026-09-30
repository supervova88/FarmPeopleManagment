import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import { indexSops } from "@/entities/sop/helpers";
import { getTariffTimeline } from "@/features/payroll/applyTariff";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Button } from "@/shared/ui/Button";
import { PageHeader } from "@/shared/ui/PageHeader";
import { TariffApprovalCard } from "@/widgets/tariff/TariffApprovalCard";
import { TariffTimeline } from "@/widgets/tariff/TariffTimeline";

/**
 * Карточка утверждения тарифа: просмотр + нетиповые операции жизненного цикла.
 */
export function TariffDetailPage() {
  const { tariffId } = useParams<{ tariffId: string }>();
  const navigate = useNavigate();
  const { state, dispatch, role, currentPerson } = useStore();

  const canManage = role.id === "tariff_methodologist" || role.id === "direction_manager";
  const canApprove = role.id === "direction_manager";

  if (!canManage) {
    return (
      <>
        <PageHeader title="Карточка тарифа" />
        <AccessDenied allowed={["tariff_methodologist", "direction_manager"]} />
      </>
    );
  }

  const tariff = state.tariffs.find((t) => t.id === tariffId);
  if (!tariff) {
    return <Navigate to="/tariffs" replace />;
  }

  const sop = indexSops(state.sops).get(tariff.sopId);
  const timeline = getTariffTimeline(tariff.sopId, tariff.divisionId, state.tariffs);

  return (
    <>
      <PageHeader
        title="Карточка утверждения тарифа"
        description="Здесь выполняются нетиповые операции: архив, восстановление, снятие утверждения. Утверждение черновика доступно и здесь, и в списке на /tariffs."
        actions={
          <Button variant="outline" onClick={() => navigate("/tariffs")}>
            <ArrowLeft size={13} />
            К списку
          </Button>
        }
      />

      <div className="mb-3 text-xs text-ink-500">
        <Link to="/tariffs" className="text-accent hover:underline">
          Управление тарифами
        </Link>
        <span className="mx-1.5">/</span>
        <span>{sop?.code ?? tariff.sopId}</span>
      </div>

      <div className="space-y-3">
        <TariffApprovalCard
          tariff={tariff}
          sop={sop}
          canApprove={canApprove}
          canManage={canManage}
          onApprove={() =>
            dispatch({
              type: "tariff/approve",
              tariffId: tariff.id,
              approverPersonId: currentPerson.id,
            })
          }
          onRejectDraft={() => {
            dispatch({ type: "tariff/reject", tariffId: tariff.id });
            navigate("/tariffs");
          }}
          onUnapprove={() => dispatch({ type: "tariff/unapprove", tariffId: tariff.id })}
          onArchive={() => dispatch({ type: "tariff/archive", tariffId: tariff.id })}
          onRestore={() => dispatch({ type: "tariff/restore", tariffId: tariff.id })}
        />

        <TariffTimeline
          sopId={tariff.sopId}
          divisionId={tariff.divisionId}
          versions={timeline}
        />
      </div>
    </>
  );
}
