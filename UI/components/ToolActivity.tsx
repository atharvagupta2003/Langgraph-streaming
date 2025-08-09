import { ToolEvent } from "@/lib/types";
import ToolCallCard from "./ToolCallCard";

interface ToolActivityProps {
  events: ToolEvent[];
}

export default function ToolActivity({ events }: ToolActivityProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-8">
        <p>No tool activity yet</p>
        <p className="text-sm mt-1">Tool calls will appear here when they occur</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 mb-4">Tool Activity</h3>
      <div className="max-h-96 overflow-y-auto">
        {events.map((event) => (
          <ToolCallCard key={event.id} {...event} />
        ))}
      </div>
    </div>
  );
}