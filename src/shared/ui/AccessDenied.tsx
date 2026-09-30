import { ShieldAlert } from "lucide-react";
import { ROLE_SHORT_LABEL, type RoleId } from "@/entities/person/model";
import { Panel, PanelBody } from "./Card";

/** Экран для роли, у которой нет доступа к разделу. Роль меняется в шапке. */
export function AccessDenied({ allowed }: { allowed: RoleId[] }) {
  const titles = allowed.map((id) => ROLE_SHORT_LABEL[id]);
  return (
    <Panel>
      <PanelBody className="flex items-start gap-3 py-6">
        <ShieldAlert size={18} className="mt-[1px] text-pending" />
        <div>
          <p className="text-sm font-semibold text-ink-900">Раздел недоступен для текущей роли</p>
          <p className="mt-1 text-xs text-ink-600">
            Доступ есть у ролей: {titles.join(", ")}. Смените роль в переключателе в шапке.
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
}
