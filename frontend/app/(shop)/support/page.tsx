export default function SupportPage() {
  const faqs = [
    { q: 'How does FairLens decide approval?', a: 'We evaluate cash-flow stability, spending burden, and liquidity buffer. The model is explainable and auditable.' },
    { q: 'Can I retry EMI with a different bank?', a: 'Yes. You can retry with another bank or alternate payment method during checkout.' },
    { q: 'Is my data stored securely?', a: 'Risk decisions are logged for monitoring. Only decision metrics are stored in the database.' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="section-kicker">Support</p>
        <h1 className="section-title">We are here to help</h1>
        <p className="text-sm text-muted mt-2">Get answers to common questions about FairLens eligibility.</p>
      </div>

      <div className="card p-6 space-y-4">
        {faqs.map((item) => (
          <div key={item.q} className="border-b border-line/60 pb-4">
            <h3 className="text-sm font-semibold">{item.q}</h3>
            <p className="text-sm text-muted mt-2">{item.a}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <p className="text-sm font-semibold">Contact risk support</p>
        <p className="text-sm text-muted mt-2">Email: support@fairlens.ai</p>
        <p className="text-sm text-muted">Phone: +91 98000 12345</p>
      </div>
    </div>
  );
}
