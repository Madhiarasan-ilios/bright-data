import Link from "next/link";
import { DemoFlowStepper } from "@/components/layout/DemoFlowStepper";

interface BreadcrumbProps {
  label: string;
  href: string;
}

interface TopNavProps {
  /** When non-null and label is non-empty, renders "Dashboard / {label}" breadcrumb. */
  breadcrumb?: BreadcrumbProps | null;
}

/**
 * Top navigation bar for the Anthropic GTM Intelligence Command Center.
 * Contains the app title (links to home) and the Demo Flow Stepper.
 *
 * When `breadcrumb` is provided with a non-empty label, renders a breadcrumb
 * element: "Dashboard / {label}" — where "Dashboard" is a Next.js Link to "/".
 */
export function TopNav({ breadcrumb = null }: TopNavProps) {
  const showBreadcrumb = breadcrumb !== null && breadcrumb.label.length > 0;

  return (
    <header className="bg-[#1e293b] border-b border-[#334155] sticky top-0 z-50">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* App title / breadcrumb area */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <Link
              href="/"
              className="text-[#f1f5f9] font-semibold text-sm sm:text-base leading-tight hover:text-[#f59e0b] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e293b] rounded shrink-0"
            >
              {showBreadcrumb ? "Dashboard" : "Anthropic GTM Intelligence Command Center"}
            </Link>

            {/* Breadcrumb separator and label (Req 9.1, 9.2, 9.4–9.7) */}
            {showBreadcrumb && (
              <>
                <span className="text-[#475569] text-sm select-none">/</span>
                <span className="text-[#f1f5f9] text-sm font-medium max-w-[200px] truncate">
                  {breadcrumb!.label}
                </span>
              </>
            )}
          </div>

          {/* Demo Flow Stepper */}
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <DemoFlowStepper />
          </div>
        </div>
      </div>
    </header>
  );
}
