/**
 * Z-API wrapper - WhatsApp (usa tokens ja existentes nos scripts).
 */
export class ZAPIClient {
  constructor(
    private instanceId = process.env.ZAPI_INSTANCE_ID!,
    private instanceToken = process.env.ZAPI_INSTANCE_TOKEN!,
    private clientToken = process.env.ZAPI_CLIENT_TOKEN!
  ) {}

  private base() { return `https://api.z-api.io/instances/${this.instanceId}/token/${this.instanceToken}`; }
  private headers(): HeadersInit { return { "Content-Type": "application/json", "Client-Token": this.clientToken }; }

  async sendText(phone: string, message: string) {
    const res = await fetch(`${this.base()}/send-text`, {
      method: "POST", headers: this.headers(),
      body: JSON.stringify({ phone, message }),
    });
    if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async sendDocument(phone: string, base64Pdf: string, fileName: string, caption?: string) {
    const res = await fetch(`${this.base()}/send-document/pdf`, {
      method: "POST", headers: this.headers(),
      body: JSON.stringify({ phone, document: `data:application/pdf;base64,${base64Pdf}`, fileName, caption }),
    });
    if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async listGroups() {
    const res = await fetch(`${this.base()}/groups`, { headers: this.headers() });
    return res.json();
  }
}
