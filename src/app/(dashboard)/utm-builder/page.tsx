import { UtmBuilder } from "@/components/utm/utm-builder";

export const dynamic = "force-dynamic";

export default function UtmBuilderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">UTM Builder</h1>
        <p className="text-muted-foreground">Monta URLs rastreaveis com UTMs padrao de mercado.</p>
      </div>
      <UtmBuilder />
    </div>
  );
}
