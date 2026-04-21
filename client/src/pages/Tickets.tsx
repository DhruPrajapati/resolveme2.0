import { TicketsTable } from "@/components/TicketsTable";

export default function Tickets() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <TicketsTable />
    </div>
  );
}
