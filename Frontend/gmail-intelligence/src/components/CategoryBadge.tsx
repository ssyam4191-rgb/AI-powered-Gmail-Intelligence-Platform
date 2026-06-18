import type { EmailCategory } from "@/types/database"

const BADGE_MAP: Record<string, string> = {
  Newsletter: "badge-newsletter",
  "Job/Recruitment": "badge-job",
  Finance: "badge-finance",
  Notifications: "badge-notifications",
  Personal: "badge-personal",
  "Work/Professional": "badge-work",
  Uncategorized: "badge-uncategorized",
}

export default function CategoryBadge({ category }: { category: string }) {
  const cls = BADGE_MAP[category] || "badge-uncategorized"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {category}
    </span>
  )
}
