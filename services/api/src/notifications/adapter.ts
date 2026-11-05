// Simulated delivery adapter (ADR-008): no external sends. It only marks delivery as 'sent'.
// `forceFail` (env NOTIFY_FORCE_FAIL=true, or set at runtime in tests) makes every delivery throw.
export interface DeliveryAdapter {
  deliver(n: { id: string; recipientId: string; channel: string; title: string; body: string }): Promise<void>;
}

export class SimulatedAdapter implements DeliveryAdapter {
  delivered: string[] = [];
  constructor(public forceFail = false, public failRecipients = new Set<string>()) {}
  async deliver(n: { id: string; recipientId: string }) {
    if (this.forceFail || this.failRecipients.has(n.recipientId)) throw new Error('simulated delivery failure');
    this.delivered.push(n.id);
  }
}
