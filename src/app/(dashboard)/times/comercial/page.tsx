import { Handshake } from "lucide-react";
import { TimePage } from "@/components/times/time-page";

export default function Page() {
  return <TimePage team="comercial" title="Time Comercial" description="Prospeccao, negociacao e fechamento." icon={Handshake} />;
}
