import { Megaphone } from "lucide-react";
import { TimePage } from "@/components/times/time-page";

export default function Page() {
  return <TimePage team="trafego" title="Time de Trafego Pago" description="Gestores e analistas de midia paga." icon={Megaphone} />;
}
