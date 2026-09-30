import { ChevronDown, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { RoleId } from "@/entities/person/model";
import { cn, MODULE_NAME, SYSTEM_NAME } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { useStore } from "./store/StoreProvider";
import { defaultRouteForRole, isRouteAllowed, navItems } from "./navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const { state, dispatch, role, currentPerson, demoRoles } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const visibleNav = navItems.filter((n) => n.roles.includes(state.currentRoleId));
  const groups = Array.from(new Set(visibleNav.map((n) => n.group)));

  function switchRole(roleId: RoleId) {
    dispatch({ type: "role/set", roleId });
    setRoleMenuOpen(false);
    if (!isRouteAllowed(location.pathname, roleId)) {
      navigate(defaultRouteForRole(roleId));
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="app-shell-header sticky top-0 z-30 border-b border-steel-800 bg-steel-900 text-white">
        <div className="mx-auto flex h-12 w-full max-w-[1440px] items-center gap-4 px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">{SYSTEM_NAME}</span>
            <span className="text-2xs text-white/55">{MODULE_NAME}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/10 px-2.5 py-1 text-xs transition-colors hover:bg-white/20"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-2xs font-semibold">
                  {currentPerson.fullName.slice(0, 1)}
                </span>
                <span className="font-medium">{role.title}</span>
                <ChevronDown size={13} className="text-white/60" />
              </button>

              {roleMenuOpen ? (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-80 overflow-hidden rounded border border-line bg-white text-ink-800 shadow-overlay">
                    <p className="border-b border-line bg-canvas px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                      Роль в демонстрации
                    </p>
                    {demoRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => switchRole(r.id)}
                        className={cn(
                          "block w-full border-b border-line-soft px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent-soft",
                          r.id === state.currentRoleId && "bg-accent-soft font-semibold",
                        )}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => dispatch({ type: "demo/reset" })}
              title="Сбросить демо-данные к исходному состоянию"
            >
              <RotateCcw size={13} />
              Сброс демо
            </Button>
          </div>
        </div>
      </header>

      <div className="app-shell-main mx-auto flex w-full max-w-[1440px] flex-1 gap-4 px-4 py-4">
        <nav className="app-shell-nav w-52 shrink-0">
          <div className="sticky top-16 space-y-4">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {visibleNav
                    .filter((n) => n.group === group)
                    .map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end
                          className={({ isActive }) =>
                            cn(
                              "block rounded px-2 py-1.5 text-xs transition-colors",
                              isActive
                                ? "bg-white font-semibold text-accent shadow-panel"
                                : "text-ink-700 hover:bg-white/70",
                            )
                          }
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
