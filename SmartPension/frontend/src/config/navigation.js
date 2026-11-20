import {
  BadgeCheck, Banknote, Database, Bell, Bot, Building2, FileText, History, Landmark, LayoutDashboard,
  LifeBuoy, MessageSquareWarning, ScanFace, ScrollText, Settings, ShieldCheck, UserCog, UserRound,
  Users, Wallet, HeartHandshake, BarChart3,
} from "lucide-react";

/** Sidebar sections for the pensioner portal. `key` = i18n key. */
export const pensionerNav = [
  {
    section: "nav.main",
    items: [
      { to: "/app/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
      { to: "/app/withdrawals", key: "nav.withdrawals", icon: Wallet },
      { to: "/app/payments", key: "nav.payments", icon: History },
      { to: "/app/statements", key: "nav.statements", icon: FileText },
    ],
  },
  {
    section: "nav.services",
    items: [
      { to: "/app/bank-accounts", key: "nav.bank", icon: Landmark },
      { to: "/app/life-verification", key: "nav.life", icon: ScanFace },
      { to: "/app/nominees", key: "nav.nominees", icon: HeartHandshake },
      { to: "/app/assistant", key: "nav.assistant", icon: Bot },
    ],
  },
  {
    section: "nav.account",
    items: [
      { to: "/app/notifications", key: "nav.notifications", icon: Bell, badge: "notifications" },
      { to: "/app/support", key: "nav.support", icon: LifeBuoy },
      { to: "/app/profile", key: "nav.profile", icon: UserRound },
    ],
  },
];

/** Sidebar sections for the admin portal. `superOnly` items are hidden for normal admins. */
export const adminNav = [
  {
    section: "nav.main",
    items: [
      { to: "/admin/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
      { to: "/admin/pensioners", key: "nav.pensioners", icon: Users },
      { to: "/admin/registry", key: "nav.registry", icon: Database },
    ],
  },
  {
    section: "nav.management",
    items: [
      { to: "/admin/withdrawals", key: "nav.adminWithdrawals", icon: Wallet },
      { to: "/admin/payments", key: "nav.adminPayments", icon: Banknote },
      { to: "/admin/bank-verifications", key: "nav.bankVerification", icon: Building2 },
      { to: "/admin/life-verifications", key: "nav.lifeMonitoring", icon: BadgeCheck },
      { to: "/admin/nominees", key: "nav.nominees", icon: HeartHandshake },
      { to: "/admin/complaints", key: "nav.complaints", icon: MessageSquareWarning },
    ],
  },
  {
    section: "nav.monitoring",
    items: [
      { to: "/admin/reports", key: "nav.reports", icon: BarChart3 },
      { to: "/admin/audit-logs", key: "nav.audit", icon: ScrollText },
    ],
  },
  {
    section: "nav.system",
    items: [
      { to: "/admin/notifications", key: "nav.notifications", icon: Bell, badge: "notifications" },
      { to: "/admin/settings", key: "nav.settings", icon: Settings },
      { to: "/admin/users", key: "nav.users", icon: UserCog, superOnly: true },
      { to: "/admin/profile", key: "nav.profile", icon: ShieldCheck },
    ],
  },
];

