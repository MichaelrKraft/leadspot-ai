"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Search,
  BarChart3,
  Settings,
  Database,
  FileText,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navigation = [
    {
      name: "Search",
      href: "/",
      icon: Search,
      description: "Knowledge synthesis",
    },
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      description: "Overview & insights",
    },
    {
      name: "Query History",
      href: "/query/history",
      icon: History,
      description: "Recent searches",
    },
    {
      name: "Data Sources",
      href: "/sources",
      icon: Database,
      description: "Manage integrations",
    },
    {
      name: "Documents",
      href: "/documents",
      icon: FileText,
      description: "Browse knowledge base",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      description: "Configure preferences",
    },
  ];

  return (
    <aside
      className={clsx(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-background-secondary border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-40",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-blue-600 dark:bg-accent-blue border border-gray-300 dark:border-gray-700 flex items-center justify-center text-white hover:bg-blue-700 dark:hover:bg-accent-lightBlue transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Navigation */}
      <nav className="h-full overflow-y-auto py-6 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                    isActive
                      ? "bg-blue-50 dark:bg-primary-900/30 text-blue-600 dark:text-primary-400 border border-blue-200 dark:border-primary-700/50"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <Icon
                    className={clsx(
                      "w-5 h-5 flex-shrink-0",
                      isActive && "text-blue-600 dark:text-primary-400"
                    )}
                  />
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 truncate">
                        {item.description}
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer info (when expanded) */}
      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-background-secondary">
          <div className="text-xs text-gray-500">
            <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">
              Knowledge Base Status
            </div>
            <div className="flex items-center justify-between">
              <span>50+ sources</span>
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
